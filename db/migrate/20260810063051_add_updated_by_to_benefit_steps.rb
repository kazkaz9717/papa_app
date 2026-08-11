class AddUpdatedByToBenefitSteps < ActiveRecord::Migration[7.2]
  def change
    add_reference :benefit_steps, :updated_by, foreign_key: { to_table: :users }
  end
end