class AddCustomLogLabelsToHouseholds < ActiveRecord::Migration[7.2]
  def change
    add_column :households, :custom_log_labels, :string, array: true, default: ["", "", "", ""], null: false
  end
end