class BenefitStep < ApplicationRecord
  STATUSES = %w[todo doing done].freeze

  belongs_to :household
  belongs_to :updated_by, class_name: "User", optional: true

  validates :phase_label, presence: true
  validates :title, presence: true
  validates :status, inclusion: { in: STATUSES }

  scope :ordered, -> { order(:position, :id) }
end