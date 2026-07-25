class CreateChecklistItems < ActiveRecord::Migration[7.2]
  def change
    create_table :checklist_items do |t|
      t.references :household, null: false, foreign_key: true
      t.string :category, null: false
      t.string :title, null: false
      t.string :detail
      t.string :place
      t.date :due_on
      t.string :url
      t.integer :position, null: false, default: 0
      t.boolean :done, null: false, default: false
      t.references :done_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :checklist_items, [:household_id, :category, :position]
  end
end