class ContractionEvent < ApplicationRecord
  # この記録は 1つの家族(household)に属する（households との「多対1」）
  belongs_to :household

  # 記録した人。指したい相手は User モデルだが、関連名が recorded_by で名前がズレるので
  # class_name: "User" で「相手は User」と明示する
  # optional: true = まだ誰も紐づいていない（空）状態を許可する
  belongs_to :recorded_by, class_name: "User", optional: true

  # occurred_at（時刻）は必ず入っていること、というルール
  validates :occurred_at, presence: true

  # 古い順に並べるための scope（間隔を計算しやすいように）
  scope :chronological, -> { order(:occurred_at) }
  # 新しい順に並べるための scope（一覧表示用）
  scope :recent_first, -> { order(occurred_at: :desc) }

  # 時刻の並びから「回数・平均間隔・病院連絡の目安」を計算するクラスメソッド
  # 引数 events には ContractionEvent の配列が渡ってくる
  def self.stats(events)
    # 各記録から時刻だけを取り出し、古い順に並べる
    times = events.map(&:occurred_at).sort

    # 隣り合う2つの時刻をペアにして、その差（＝間隔・秒）を計算する
    # 例: [10分前, 4分前, 今] → ペアは [10分前,4分前] と [4分前,今] → [360秒, 240秒]
    intervals = times.each_cons(2).map { |a, b| b - a }

    # 間隔が1つも無ければ平均は nil、あれば合計 ÷ 個数で平均を出す
    avg = intervals.empty? ? nil : (intervals.sum / intervals.size)

    # 画面に返す情報をまとめて返す
    {
      count: times.size,                # 記録した回数
      average_interval_sec: avg&.round, # 平均間隔（秒）。avg が nil のときは nil のまま
      last_occurred_at: times.last,     # 最後に記録した時刻
      # 病院連絡の目安: 平均が5分（300秒）以下 かつ 間隔が3回以上 のとき true
      call_hospital: avg.present? && avg <= 5 * 60 && intervals.size >= 3
    }
  end
end