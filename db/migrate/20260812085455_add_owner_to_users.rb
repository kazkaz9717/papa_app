class AddOwnerToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :owner, :boolean, default: false, null: false
  end
end