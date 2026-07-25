class ChecklistItem < ApplicationRecord
  belongs_to :household
  belongs_to :done_by
end
