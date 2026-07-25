class Household < ApplicationRecord
  has_many :users, dependent: :destroy
  has_many :checklist_items, dependent: :destroy

  before_validation :ensure_invite_code, on: :create

  validates :name, presence: true
  validates :invite_code, presence: true, uniqueness: true

  private

  def ensure_invite_code
    self.invite_code ||= loop do
      code = SecureRandom.alphanumeric(6).upcase
      break code unless Household.exists?(invite_code: code)
    end
  end
end