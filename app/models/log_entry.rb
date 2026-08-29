class LogEntry < ApplicationRecord
  KINDS = %w[milk breast solid meal drink pee poop both sleep_start wake custom].freeze
  AMOUNT_KINDS = %w[milk breast].freeze

  belongs_to :household
  belongs_to :recorded_by, class_name: "User", optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :occurred_at, presence: true
  validates :note, presence: true, if: -> { kind == "custom" }

  scope :recent_first, -> { order(occurred_at: :asc) }
  scope :for_date, ->(date) { where(occurred_at: date.beginning_of_day..date.end_of_day) }
  scope :today, -> { for_date(Date.current) }
end