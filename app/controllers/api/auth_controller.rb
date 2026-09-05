module Api
  class AuthController < BaseController
    skip_before_action :authenticate!, only: %i[signup login guest_login]

    def signup
      ActiveRecord::Base.transaction do
        is_new_household = params[:invite_code].blank?
        household =
          if is_new_household
            Household.create!(name: params[:household_name].presence || "わたしの家族", due_on: params[:due_on].presence)
          else
            Household.find_by!(invite_code: params[:invite_code].to_s.strip.upcase)
          end
        user = household.users.create!(
          name: params[:name], email: params[:email],
          password: params[:password], role: params[:role].presence || "husband",
          owner: is_new_household
        )
        render json: payload(user), status: :created
      end
    rescue ActiveRecord::RecordNotFound
      render json: { error: "招待コードが見つかりません" }, status: :unprocessable_entity
    rescue ActiveRecord::RecordInvalid => e
      render json: { error: e.record.errors.full_messages.join("、") }, status: :unprocessable_entity
    end

    def login
      user = User.find_by(email: params[:email].to_s.strip.downcase)
      if user&.authenticate(params[:password])
        render json: payload(user)
      else
        render json: { error: "メールアドレスまたはパスワードが違います" }, status: :unauthorized
      end
    end

    # ゲストログイン：呼ばれるたびに新しい使い捨ての家族・ユーザーを作る
    def guest_login
      household = Household.create!(name: "ゲストのデモ家族", due_on: 30.days.from_now.to_date, guest: true)
      user = household.users.create!(
        name: "ゲスト", email: "guest-#{SecureRandom.hex(8)}@papa-app.local",
        password: SecureRandom.hex(16), role: "husband", owner: true
      )
      render json: payload(user)
    end

    def me
      render json: payload(current_user)
    end

    # タイルの並び順を保存する（ユーザーごと、他のメンバーには影響しない）
    def update_tile_order
      current_user.update!(tile_order: params[:tile_order] || [])
      render json: { tile_order: current_user.tile_order }
    end

    private

    def payload(user)
      {
        token: user.api_token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, owner: user.owner, tile_order: user.tile_order },
        household: household_json(user.household)
      }
    end
  end
end