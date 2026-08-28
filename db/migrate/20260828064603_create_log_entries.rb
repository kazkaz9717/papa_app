class CreateLogEntries < ActiveRecord::Migration[7.2]
  def change
    create_table :log_entries do |t|
      t.references :household, null: false, foreign_key: true
      t.string :kind, null: false
      t.datetime :occurred_at, null: false
      t.references :recorded_by, foreign_key: { to_table: :users }

      t.timestamps
    end
  end
end