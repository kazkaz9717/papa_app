class CreateUsers < ActiveRecord::Migration[7.2]
  def change
    create_table :users do |t|
      t.references :household, null: false, foreign_key: true
      t.string :name
      t.string :email
      t.string :password_digest
      t.string :api_token
      t.string :role

      t.timestamps
    end
    add_index :users, :email, unique: true
    add_index :users, :api_token, unique: true
  end
end
