class CreateContractionEvents < ActiveRecord::Migration[7.2]
  def change
    # contraction_events（陣痛の記録）テーブルを作る
    create_table :contraction_events do |t|
      # どの家族の記録か。households を指す外部キー。null: false = 必須
      t.references :household, null: false, foreign_key: true

      # 陣痛が来た時刻。null: false = 必須
      t.datetime :occurred_at, null: false

      # 誰が記録したか。users を指す外部キー（関連名が recorded_by なので to_table で users を明示）
      # null 指定なし = 空でもOK（誰の記録か未設定を許す）
      t.references :recorded_by, foreign_key: { to_table: :users }

      # created_at / updated_at（作成・更新時刻）を自動で用意する
      t.timestamps
    end

    # 「家族ごと × 時刻順」で素早く取り出せるようにするための索引（インデックス）
    add_index :contraction_events, [:household_id, :occurred_at]
  end
end