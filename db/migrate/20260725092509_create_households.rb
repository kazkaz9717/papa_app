class CreateHouseholds < ActiveRecord::Migration[7.2]
  def change
    create_table :households do |t|
      t.string :name
      t.date :due_on
      t.date :birth_on
      t.string :baby_name
      t.string :invite_code

      t.timestamps
    end
    add_index :households, :invite_code, unique: true
  end
end
