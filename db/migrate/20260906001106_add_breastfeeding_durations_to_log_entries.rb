class AddBreastfeedingDurationsToLogEntries < ActiveRecord::Migration[7.2]
  def change
    add_column :log_entries, :left_duration_sec, :integer
    add_column :log_entries, :right_duration_sec, :integer
  end
end
