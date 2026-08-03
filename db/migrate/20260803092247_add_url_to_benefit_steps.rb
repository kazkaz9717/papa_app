class AddUrlToBenefitSteps < ActiveRecord::Migration[7.2]
  def change
    add_column :benefit_steps, :url, :string
  end
end
