module Api
  class HouseholdController < BaseController
    # GET /api/household
    # 家族の基本情報＋メンバー一覧（誰が夫/妻として参加しているか）を返す
    def show
      render json: household_json(current_household)
    end

    # PATCH /api/household
    # 家族の名前・出産予定日・赤ちゃんの名前を更新する
    def update
      current_household.update!(household_params)
      render json: household_json(current_household)
    rescue ActiveRecord::RecordInvalid => e
      render json: { error: e.record.errors.full_messages.join("、") }, status: :unprocessable_entity
    end

    private

    def household_params
      params.permit(:name, :due_on, :birth_on, :baby_name)
    end

    def household_json(household)
      {
        id: household.id,
        name: household.name,
        due_on: household.due_on,
        birth_on: household.birth_on,
        baby_name: household.baby_name,
        invite_code: household.invite_code,
        members: household.users.map { |u| { name: u.name, role: u.role, role_label: u.role_label } }
      }
    end
  end
end