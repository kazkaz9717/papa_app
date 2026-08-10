class AddCreatedByToChecklistItems < ActiveRecord::Migration[7.2]
  def change
    add_reference :checklist_items, :created_by, foreign_key: { to_table: :users }
  end
end