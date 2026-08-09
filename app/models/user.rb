class User < ApplicationRecord
  ROLES = %w[husband wife other].freeze

  belongs_to :household
  has_secure_password
  has_secure_token :api_token

  before_validation { self.email = email.to_s.strip.downcase }

  validates :name, presence: true
  validates :email, presence: true, uniqueness: true
  validates :role, inclusion: { in: ROLES }
  ROLE_LABELS = { "husband" => "夫", "wife" => "妻", "other" => "その他" }.freeze

  def role_label
    ROLE_LABELS[role]
  end
end