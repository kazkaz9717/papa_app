class LogEntry < ApplicationRecord
  # milk/breastは過去データ表示のため残すが、新規記録では使わない
  # breast_left/breast_rightは廃止し、breastfeeding（左右2カラムの1エントリ）に統合した
  KINDS = %w[
    milk breast solid meal drink pee poop both sleep_start wake custom
    breastfeeding pump bottle snack temperature medicine
    runny_nose fever vomit
  ].freeze

  belongs_to :household
  belongs_to :recorded_by, class_name: "User", optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :occurred_at, presence: true
  validates :note, presence: true, if: -> { kind == "custom" }

  scope :recent_first, -> { order(occurred_at: :asc) }
  scope :for_date, ->(date) { where(occurred_at: date.beginning_of_day..date.end_of_day) }
  scope :today, -> { for_date(Date.current) }
end