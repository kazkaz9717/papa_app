class Household < ApplicationRecord
  has_many :users, dependent: :destroy
  has_many :checklist_items, dependent: :destroy
  # この家族の陣痛の記録（1つの家族が複数の記録を持つ）
  has_many :contraction_events, dependent: :destroy
  # この家族の育休・給付金ステップ
  has_many :benefit_steps, dependent: :destroy

  before_validation :ensure_invite_code, on: :create
  after_create :seed_default_checklist_items
  after_create :seed_default_benefit_steps

  validates :name, presence: true
  validates :invite_code, presence: true, uniqueness: true

  DEFAULT_CHECKLIST = {
    "prep" => [
      { title: "入院バッグを準備する" },
      { title: "病院までのルート・交通手段を確認" },
      { title: "職場に出産予定・育休を相談" },
      { title: "産後の家事分担・買い出し計画" }
    ],
    "day" => [
      { title: "入院バッグを玄関に置く" },
      { title: "病院へ連絡する" },
      { title: "タクシー / 車を手配する" },
      { title: "家族・職場へ第一報" }
    ],
    "procedure" => [
      { title: "妊娠届（母子手帳の交付）", place: "市区町村役場",
        detail: "妊娠が分かったらできるだけ早めに。母子手帳・妊婦健診補助券が交付される" },
      { title: "出生届", place: "市区町村役場", detail: "出生証明書・母子手帳・印鑑（14日以内）",
        url: "https://www.moj.go.jp/ONLINE/FAMILYREGISTER/5-1.html" },
      { title: "児童手当の申請", place: "市区町村役場", detail: "出生翌日から15日以内。遅れると1か月分が消える",
        url: "https://www.cfa.go.jp/policies/kokoseido/jidouteate/mottoouen" },
      { title: "健康保険の加入", place: "勤務先 または 役場（国保）", detail: "医療費助成・一時金の前提" },
      { title: "乳幼児医療費助成", place: "市区町村役場", detail: "保険証ができ次第" },
      { title: "出産育児一時金", place: "健康保険（病院経由）", detail: "原則50万円・多くは直接支払",
        url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryouhoken/shussan/index.html" },
      { title: "出産手当金の申請（妻）", place: "勤務先の健康保険（協会けんぽ等）",
        detail: "産休中の給与の一部を補償。産後休業終了後に申請するのが一般的",
        url: "https://www.kyoukaikenpo.or.jp/application_form/benefit/009/index.html" }
    ]
  }.freeze

  # 育休・給付金の初期ステップ（新規登録時に自動で入れる、案A：ひな形をコピー）
  DEFAULT_BENEFIT_STEPS = [
    { phase_label: "出産前", title: "育休を勤務先に申請",
      description: "産後パパ育休は原則2週間前まで。給付は勤務先経由でハローワークへ", timing_note: "出産前",
      url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000135090_00001.html" },
    { phase_label: "出生〜8週", title: "産後パパ育休を取得",
      description: "出生後8週内に4週間分まで、2回に分割可", timing_note: "今ここ",
      url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000135090_00001.html" },
    { phase_label: "約2〜3か月後", title: "給付金が初回入金",
      description: "出生時育児休業給付金67％＋出生後休業支援給付13％＝計80％", timing_note: "育休の約2〜3か月後",
      url: "https://www.hellowork.mhlw.go.jp/insurance/insurance_childcareleave.html" },
    { phase_label: "181日目以降", title: "育児休業給付金へ移行",
      description: "はじめ67％、181日目以降は50％。2か月ごとに支給", timing_note: "181日目以降",
      url: "https://www.hellowork.mhlw.go.jp/insurance/insurance_childcareleave.html" }
  ].freeze

  private

  def ensure_invite_code
    self.invite_code ||= loop do
      code = SecureRandom.alphanumeric(6).upcase
      break code unless Household.exists?(invite_code: code)
    end
  end

  def seed_default_checklist_items
    DEFAULT_CHECKLIST.each do |category, items|
      items.each_with_index do |attrs, i|
        checklist_items.create!(attrs.merge(category: category, position: i))
      end
    end
  end

  # 家族が作られた直後、育休・給付金の初期ステップをまとめて作る
  def seed_default_benefit_steps
    DEFAULT_BENEFIT_STEPS.each_with_index do |attrs, i|
      benefit_steps.create!(attrs.merge(position: i, status: "todo"))
    end
  end
end