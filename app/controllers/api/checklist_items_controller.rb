module Api
  class ChecklistItemsController < BaseController
    # 一覧（categoryごとに仕分けして返す）
    def index
      items = current_household.checklist_items.ordered
      grouped = ChecklistItem::CATEGORIES.index_with do |category|
        scoped = items.select { |i| i.category == category }
        scoped = scoped.select { |i| i.created_by_id == current_user.id } if category == "gift"
        scoped.map { |i| item_json(i) }
      end
      render json: grouped
    end

    # 追加（INSERT 1件）
    def create
      attrs = item_params
      item = current_household.checklist_items.create!(
        attrs.merge(position: next_position(attrs[:category]), created_by: current_user)
      )
      render json: item_json(item), status: :created
    rescue ActiveRecord::RecordInvalid => e
      render json: { error: e.record.errors.full_messages.join("、") }, status: :unprocessable_entity
    end

    # 更新（完了トグルや編集）
    def update
      item = find_own_item(params[:id])
      attrs = update_params
      attrs[:done_by] = attrs[:done] ? current_user : nil if attrs.key?(:done)
      item.update!(attrs)
      render json: item_json(item)
    rescue ActiveRecord::RecordInvalid => e
      render json: { error: e.record.errors.full_messages.join("、") }, status: :unprocessable_entity
    end

    def destroy
      find_own_item(params[:id]).destroy!
      head :no_content
    end

    private

    def find_own_item(id)
      item = current_household.checklist_items.find(id)
      raise ActiveRecord::RecordNotFound if item.category == "gift" && item.created_by_id != current_user.id
      item
    end

    def update_params
      params.permit(:title, :detail, :place, :url, :due_on, :done).to_h.symbolize_keys
    end

    def next_position(category)
      (current_household.checklist_items.where(category: category).maximum(:position) || -1) + 1
    end

    def item_json(item)
      {
        id: item.id, category: item.category, title: item.title,
        detail: item.detail, place: item.place, url: item.url,
        due_on: item.due_on, position: item.position, done: item.done,
        done_by: item.done_by&.name
      }
    end
  end
end