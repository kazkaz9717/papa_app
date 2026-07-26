class Household < ApplicationRecord
  has_many :users, dependent: :destroy
  has_many :checklist_items, dependent: :destroy
  # この家族の陣痛の記録（1つの家族が複数の記録を持つ）
  has_many :contraction_events, dependent: :destroy

  before_validation :ensure_invite_code, on: :create
  after_create :seed_default_checklist_items

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
      { title: "出生届", place: "市区町村役場", detail: "出生証明書・母子手帳・印鑑（14日以内）" },
      { title: "児童手当の申請", place: "市区町村役場", detail: "出生翌日から15日以内。遅れると1か月分が消える" },
      { title: "健康保険の加入", place: "勤務先 または 役場（国保）" },
      { title: "出産育児一時金", detail: "原則50万円・多くは直接支払" }
    ]
  }.freeze

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
end