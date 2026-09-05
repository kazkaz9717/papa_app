class AddTileOrderToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :tile_order, :string, array: true, default: [], null: false
  end
end