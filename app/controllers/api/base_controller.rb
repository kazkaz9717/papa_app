module Api
  class BaseController < ActionController::API
    before_action :authenticate!

    private

    def authenticate!
      token = request.headers["Authorization"].to_s.sub(/\ABearer /, "").strip
      @current_user = User.find_by(api_token: token) if token.present?
      render_unauthorized unless @current_user
    end

    def current_user
      @current_user
    end

    def current_household
      @current_user&.household
    end

    def render_unauthorized
      render json: { error: "ログインが必要です" }, status: :unauthorized
    end

    def household_json(household)
      {
        id: household.id, name: household.name, due_on: household.due_on,
        birth_on: household.birth_on, baby_name: household.baby_name,
        invite_code: household.invite_code
      }
    end
  end
end