module Api
  class HouseholdController < BaseController
    def show
      render json: household_json(current_household)
    end

    def update
      current_household.update!(household_params)
      render json: household_json(current_household)
    rescue ActiveRecord::RecordInvalid => e
      render json: { error: e.record.errors.full_messages.join("、") }, status: :unprocessable_entity
    end

    # 家族を作成した人（オーナー）だけが、他のメンバーを削除できる
    def remove_member
      unless current_user.owner?
        render json: { error: "家族を作成した人だけがメンバーを削除できます" }, status: :forbidden
        return
      end

      member = current_household.users.find(params[:id])
      if member == current_user
        render json: { error: "自分自身は削除できません" }, status: :unprocessable_entity
        return
      end

      member.destroy!
      render json: household_json(current_household)
    end

    # オーナーだけが、招待コードを再発行できる（古いコードは使えなくなる）
    def regenerate_invite_code
      unless current_user.owner?
        render json: { error: "家族を作成した人だけが招待コードを再発行できます" }, status: :forbidden
        return
      end

      current_household.regenerate_invite_code!
      render json: household_json(current_household)
    end

        def custom_log_labels
      render json: { custom_log_labels: current_household.custom_log_labels.reject(&:blank?) }
    end

    # label指定なら末尾に追加、remove_index指定ならその位置を削除、reorder指定なら並び順をまるごと差し替える
    def update_custom_log_labels
        labels = current_household.custom_log_labels.reject(&:blank?)

        if params[:remove_index].present?
            index = params[:remove_index].to_i
            labels.delete_at(index) if index.between?(0, labels.length - 1)
        elsif params[:label].present?
            labels << params[:label].to_s.strip
        elsif params[:reorder].is_a?(Array)
            # 家族で共有する項目なので、並び順もそのまま家族全員に反映される
            labels = params[:reorder].map(&:to_s).reject(&:blank?)
        end

        current_household.update!(custom_log_labels: labels)
        render json: { custom_log_labels: current_household.custom_log_labels }
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
        members: household.users.map { |u| { id: u.id, name: u.name, role: u.role, role_label: u.role_label, owner: u.owner } }
      }
    end
  end
end