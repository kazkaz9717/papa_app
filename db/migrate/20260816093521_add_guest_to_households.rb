class AddGuestToHouseholds < ActiveRecord::Migration[7.2]
  def change
    add_column :households, :guest, :boolean, default: false, null: false
  end
end