module Api
  class AuthController < BaseController
    skip_before_action :authenticate!, only: %i[signup login]

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

    def me
      render json: payload(current_user)
    end

    private

    def payload(user)
      {
        token: user.api_token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, owner: user.owner },
        household: household_json(user.household)
      }
    end
  end
end