class AddNoteToLogEntries < ActiveRecord::Migration[7.2]
  def change
    add_column :log_entries, :note, :text
  end
end
