class ChecklistItem < ApplicationRecord
  CATEGORIES = %w[prep day procedure gift].freeze

  belongs_to :household
  belongs_to :done_by, class_name: "User", optional: true

  validates :category, inclusion: { in: CATEGORIES }
  validates :title, presence: true

  scope :ordered, -> { order(:position, :id) }
end