class AddAmountAndMemoToLogEntries < ActiveRecord::Migration[7.2]
  def change
    add_column :log_entries, :amount, :integer
    add_column :log_entries, :memo, :text
  end
end
