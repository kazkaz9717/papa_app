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
    times = events.map(&:occurred_at).sort
    recent = times.select { |t| t >= 1.hour.ago }   # 直近1時間だけで判断
    intervals = recent.each_cons(2).map { |a, b| b - a }
    avg = intervals.empty? ? nil : (intervals.sum / intervals.size)
    {
      count: times.size,
      average_interval_sec: avg&.round,
      last_occurred_at: times.last,
      call_hospital: avg.present? && avg <= 5 * 60 && intervals.size >= 3
    }
  end
end