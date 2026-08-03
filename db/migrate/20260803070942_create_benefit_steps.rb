class CreateBenefitSteps < ActiveRecord::Migration[7.2]
  def change
    # benefit_steps（育休・給付金の各ステップ）テーブルを作る
    create_table :benefit_steps do |t|
      # どの家族のステップか
      t.references :household, null: false, foreign_key: true

      # 表示順（0,1,2,3...）。時間軸の並びを保つために使う
      t.integer :position, null: false, default: 0

      # フェーズ名（例: "出産前"、"出生〜8週"）
      t.string :phase_label, null: false

      # ステップのタイトル（例: "育休を勤務先に申請"）
      t.string :title, null: false

      # 補足説明（長文なので text 型）
      t.text :description

      # 進捗状態。todo（未）/ doing（進行中）/ done（完了）の3種類のみ許可（モデル側で制御）
      t.string :status, null: false, default: "todo"

      # 時期の目安の表示用文字列（例: "今ここ"、"181日目以降"）
      t.string :timing_note

      t.timestamps
    end

    # 「家族ごと × 並び順」で素早く取り出すための索引
    add_index :benefit_steps, [:household_id, :position]
  end
end