class AddFeedingDetailsToLogEntries < ActiveRecord::Migration[7.2]
  def change
    add_column :log_entries, :duration_sec, :integer
    add_column :log_entries, :breast_ml, :integer
    add_column :log_entries, :formula_ml, :integer
    add_column :log_entries, :temperature, :decimal, precision: 4, scale: 1
  end
end
