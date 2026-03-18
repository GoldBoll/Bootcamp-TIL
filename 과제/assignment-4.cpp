#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <windows.h>

// ==================== 입력 헬퍼 ====================
// cin >> 이후 남은 개행을 제거하고 한 줄을 읽어 반환한다.
// main의 모든 메뉴 분기에서 동일하게 반복되던 패턴을 함수로 분리했다.
std::string ReadLine(const std::string& prompt) {
    std::cout << prompt;
    std::cin.ignore(10000, '\n');   // 이전 입력의 잔여 개행 제거
    std::string input;
    std::getline(std::cin, input);
    return input;
}

// ==================== PotionRecipe ====================
// 물약 하나의 이름과 재료 목록을 담는 순수 데이터 클래스 (값 객체).
// 생성 후 내용을 바꿀 필요가 없으므로 setter는 두지 않는다.
class PotionRecipe {
public:
    PotionRecipe(const std::string& name, const std::vector<std::string>& ingredients)
        : name_(name), ingredients_(ingredients) {}

    const std::string& GetName() const { return name_; }
    const std::vector<std::string>& GetIngredients() const { return ingredients_; }

private:
    std::string name_;
    std::vector<std::string> ingredients_;
};

// ==================== RecipeManager ====================
// 레시피 목록의 추가/검색만 담당한다 (SRP).
// 재고·지급 등 다른 책임은 전혀 갖지 않는다.
class RecipeManager {
public:
    // 레시피를 추가한다.
    // - 같은 이름이 이미 있으면 거부하고 nullptr을 반환한다.
    // - 성공 시 추가된 객체의 포인터를 반환한다(AlchemyWorkshop이 재고 초기화에 활용).
    PotionRecipe* AddRecipe(const std::string& name, const std::vector<std::string>& ingredients) {
        for (auto& r : recipes_) {
            if (r.GetName() == name) {
                std::cout << ">> 이미 존재하는 레시피입니다: " << name << std::endl;
                return nullptr;
            }
        }
        recipes_.push_back(PotionRecipe(name, ingredients));
        return &recipes_.back();
    }

    // 이름으로 레시피를 정확히 1개 찾는다.
    // 이름이 동일한 레시피는 없다고 보장되므로 첫 번째 일치 즉시 반환한다.
    // 없으면 nullptr을 반환한다.
    const PotionRecipe* FindRecipeByName(const std::string& name) const {
        for (const auto& r : recipes_) {
            if (r.GetName() == name) return &r;
        }
        return nullptr;
    }

    // 특정 재료를 포함하는 레시피를 모두 찾아 복사본 벡터로 반환한다.
    // 결과가 없으면 빈 벡터를 반환한다.
    std::vector<PotionRecipe> FindRecipesByIngredient(const std::string& ingredient) const {
        std::vector<PotionRecipe> result;
        for (const auto& r : recipes_) {
            for (const auto& ing : r.GetIngredients()) {
                if (ing == ingredient) {
                    result.push_back(r);
                    break;  // 같은 레시피를 중복 추가하지 않도록 내부 루프 탈출
                }
            }
        }
        return result;
    }

    // 전체 레시피 목록의 읽기 전용 참조를 반환한다.
    const std::vector<PotionRecipe>& GetAllRecipes() const { return recipes_; }

private:
    std::vector<PotionRecipe> recipes_;
};

// ==================== StockManager ====================
// 물약별 재고 수량만 관리한다 (SRP).
// 재고 정책(MAX_STOCK)이 바뀌어도 이 클래스만 수정하면 된다 (OCP).
class StockManager {
public:
    // 모든 물약의 최대 재고. constexpr이므로 컴파일 타임에 결정된다.
    static constexpr int MAX_STOCK = 3;

    // 새 레시피가 추가될 때 호출한다. 초기 재고를 MAX_STOCK으로 설정한다.
    void InitializeStock(const std::string& potionName) {
        potionStock_[potionName] = MAX_STOCK;
    }

    // 재고가 1개 이상이면 1개를 지급(감소)하고 true를 반환한다.
    // 재고가 0이면 지급하지 않고 false를 반환한다.
    bool DispensePotion(const std::string& potionName) {
        auto it = potionStock_.find(potionName);
        if (it == potionStock_.end() || it->second <= 0) return false;
        it->second--;
        return true;
    }

    // 공병을 반환받아 재고를 1 증가시킨다.
    // 이미 MAX_STOCK이면 더 이상 늘리지 않고 안내 메시지를 출력한다.
    void ReturnPotion(const std::string& potionName) {
        auto it = potionStock_.find(potionName);
        if (it == potionStock_.end()) {
            std::cout << ">> 해당 물약의 재고 정보가 없습니다." << std::endl;
            return;
        }
        if (it->second >= MAX_STOCK) {
            std::cout << ">> 창고가 가득 찼습니다. 최대 " << MAX_STOCK << "개까지 보관 가능합니다." << std::endl;
            return;
        }
        it->second++;
        std::cout << ">> '" << potionName << "' 공병 반환 완료. 현재 재고: " << it->second << std::endl;
    }

    // 현재 재고를 반환한다. 등록된 적 없는 이름이면 0을 반환한다.
    int GetStock(const std::string& potionName) const {
        auto it = potionStock_.find(potionName);
        if (it == potionStock_.end()) return 0;
        return it->second;
    }

private:
    // key: 물약 이름, value: 현재 재고 수량
    std::map<std::string, int> potionStock_;
};

// ==================== AlchemyWorkshop ====================
// RecipeManager(레시피 관리)와 StockManager(재고 관리)를 조합해
// 공방 전체 기능을 외부에 제공하는 파사드(Facade) 역할을 한다.
// 두 매니저의 내부 구현이 바뀌어도 이 클래스의 공개 인터페이스는 유지된다.
class AlchemyWorkshop {
public:
    // 레시피를 추가하고, 성공 시 재고를 자동으로 MAX_STOCK(3)개로 초기화한다.
    void AddRecipe(const std::string& potionName, const std::vector<std::string>& ingredients) {
        PotionRecipe* added = recipeManager_.AddRecipe(potionName, ingredients);
        if (added) {
            stockManager_.InitializeStock(potionName);
            std::cout << ">> 새로운 레시피 '" << potionName << "'이(가) 추가되었습니다. (초기 재고: 3)" << std::endl;
        }
    }

    // 등록된 모든 레시피와 현재 재고를 출력한다.
    void DisplayAllRecipes() const {
        const auto& recipes = recipeManager_.GetAllRecipes();
        if (recipes.empty()) {
            std::cout << "아직 등록된 레시피가 없습니다." << std::endl;
            return;
        }
        std::cout << "\n--- [ 전체 레시피 목록 ] ---" << std::endl;
        for (const auto& r : recipes) {
            std::cout << "- 물약 이름: " << r.GetName()
                      << " (재고: " << stockManager_.GetStock(r.GetName()) << ")" << std::endl;
            PrintIngredients(r);
        }
        std::cout << "---------------------------\n";
    }

    // [필수] 물약 이름으로 레시피 1개를 정확히 검색한다.
    // 입력이 비어있거나 결과가 없으면 안내 메시지를 출력한다.
    void SearchByName(const std::string& name) const {
        // 개선: 빈 문자열 입력 방어
        if (name.empty()) {
            std::cout << ">> 물약 이름을 입력해주세요." << std::endl;
            return;
        }
        const PotionRecipe* recipe = recipeManager_.FindRecipeByName(name);
        if (!recipe) {
            std::cout << ">> '" << name << "' 이름의 레시피를 찾을 수 없습니다." << std::endl;
            return;
        }
        std::cout << "\n--- [ 검색 결과 ] ---" << std::endl;
        std::cout << "- 물약 이름: " << recipe->GetName()
                  << " (재고: " << stockManager_.GetStock(recipe->GetName()) << ")" << std::endl;
        PrintIngredients(*recipe);
        std::cout << "--------------------\n";
    }

    // [필수] 재료 이름으로 해당 재료를 포함한 모든 레시피를 검색한다.
    // 입력이 비어있거나 결과가 없으면 안내 메시지를 출력한다.
    void SearchByIngredient(const std::string& ingredient) const {
        // 개선: 빈 문자열 입력 방어
        if (ingredient.empty()) {
            std::cout << ">> 재료 이름을 입력해주세요." << std::endl;
            return;
        }
        std::vector<PotionRecipe> results = recipeManager_.FindRecipesByIngredient(ingredient);
        if (results.empty()) {
            std::cout << ">> '" << ingredient << "' 재료를 사용하는 레시피가 없습니다." << std::endl;
            return;
        }
        std::cout << "\n--- [ '" << ingredient << "' 재료 포함 레시피 ] ---" << std::endl;
        for (const auto& r : results) {
            std::cout << "- " << r.GetName()
                      << " (재고: " << stockManager_.GetStock(r.GetName()) << ")" << std::endl;
            PrintIngredients(r);
        }
        std::cout << "--------------------\n";
    }

    // [도전] 이름으로 물약을 1개 지급한다.
    // 레시피가 없거나 재고가 0이면 실패 메시지를 출력하고 false를 반환한다.
    bool DispensePotionByName(const std::string& potionName) {
        // 개선: 빈 문자열 입력 방어
        if (potionName.empty()) {
            std::cout << ">> 물약 이름을 입력해주세요." << std::endl;
            return false;
        }
        if (!recipeManager_.FindRecipeByName(potionName)) {
            std::cout << ">> '" << potionName << "' 레시피가 존재하지 않습니다." << std::endl;
            return false;
        }
        bool success = stockManager_.DispensePotion(potionName);
        if (success)
            std::cout << ">> '" << potionName << "' 지급 완료. 남은 재고: "
                      << stockManager_.GetStock(potionName) << std::endl;
        else
            std::cout << ">> '" << potionName << "' 재고가 부족합니다." << std::endl;
        return success;
    }

    // [도전] 재료 이름으로 해당 재료가 포함된 물약 중 재고가 있는 것을 모두 지급한다.
    // 실제로 지급된 물약 이름 목록을 반환한다(없으면 빈 벡터).
    std::vector<std::string> DispensePotionsByIngredient(const std::string& ingredient) {
        // 개선: 빈 문자열 입력 방어
        if (ingredient.empty()) {
            std::cout << ">> 재료 이름을 입력해주세요." << std::endl;
            return {};
        }
        std::vector<PotionRecipe> found = recipeManager_.FindRecipesByIngredient(ingredient);
        std::vector<std::string> dispensed;
        for (const auto& r : found) {
            if (stockManager_.DispensePotion(r.GetName())) {
                dispensed.push_back(r.GetName());
                std::cout << ">> '" << r.GetName() << "' 지급 완료. 남은 재고: "
                          << stockManager_.GetStock(r.GetName()) << std::endl;
            }
        }
        if (dispensed.empty())
            std::cout << ">> '" << ingredient << "' 재료를 사용하는 물약 중 재고 있는 것이 없습니다." << std::endl;
        return dispensed;
    }

    // [도전] 모험가에게서 공병을 돌려받아 재고를 1 복구한다.
    // 레시피가 없거나 이미 MAX_STOCK이면 StockManager가 안내 메시지를 출력한다.
    void ReturnPotionByName(const std::string& potionName) {
        // 개선: 빈 문자열 입력 방어
        if (potionName.empty()) {
            std::cout << ">> 물약 이름을 입력해주세요." << std::endl;
            return;
        }
        if (!recipeManager_.FindRecipeByName(potionName)) {
            std::cout << ">> '" << potionName << "' 레시피가 존재하지 않습니다." << std::endl;
            return;
        }
        stockManager_.ReturnPotion(potionName);
    }

    // 특정 물약의 현재 재고를 반환한다.
    int GetStockByName(const std::string& potionName) const {
        return stockManager_.GetStock(potionName);
    }

private:
    RecipeManager recipeManager_;   // 레시피 추가/검색 담당
    StockManager  stockManager_;    // 재고 수량 관리 담당

    // 재료 목록을 ", "로 구분해 출력하는 헬퍼.
    // DisplayAllRecipes, SearchByName, SearchByIngredient 세 곳에서 공통 사용한다.
    void PrintIngredients(const PotionRecipe& r) const {
        std::cout << "  > 필요 재료: ";
        const auto& ings = r.GetIngredients();
        for (size_t j = 0; j < ings.size(); ++j) {
            std::cout << ings[j];
            if (j < ings.size() - 1) std::cout << ", ";
        }
        std::cout << std::endl;
    }
};
// ==================== main ====================
int main() {
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    AlchemyWorkshop myWorkshop;

    while (true) {
        std::cout << "\n  연금술 공방 관리 시스템\n";
        std::cout << "1. 레시피 추가\n";
        std::cout << "2. 모든 레시피 출력\n";
        std::cout << "3. 이름으로 레시피 검색   [필수]\n";
        std::cout << "4. 재료로 레시피 검색     [필수]\n";
        std::cout << "5. 물약 지급 (이름)       [도전]\n";
        std::cout << "6. 물약 지급 (재료)       [도전]\n";
        std::cout << "7. 공병 반환              [도전]\n";
        std::cout << "8. 종료\n";
        std::cout << "선택: ";

        int choice;
        std::cin >> choice;

        // 숫자가 아닌 값을 입력했을 때 cin 오류 상태를 복구한다.
        if (std::cin.fail()) {
            std::cout << "잘못된 입력입니다. 숫자를 입력해주세요." << std::endl;
            std::cin.clear();
            std::cin.ignore(10000, '\n');
            continue;
        }

        if (choice == 1) {
            // 개선: ReadLine 헬퍼로 중복 제거 + 빈 이름 방어
            std::string name = ReadLine("물약 이름: ");
            if (name.empty()) {
                std::cout << ">> 물약 이름을 입력해주세요." << std::endl;
                continue;
            }

            std::vector<std::string> ingredients;
            std::cout << "재료들을 입력하세요. (완료 시 '끝' 입력)\n";
            while (true) {
                std::cout << "재료 입력: ";
                std::string ingredient;
                std::getline(std::cin, ingredient);
                if (ingredient == "끝") break;
                if (!ingredient.empty()) ingredients.push_back(ingredient);
            }
            if (!ingredients.empty())
                myWorkshop.AddRecipe(name, ingredients);
            else
                std::cout << ">> 재료가 입력되지 않아 레시피 추가를 취소합니다." << std::endl;

        } else if (choice == 2) {
            myWorkshop.DisplayAllRecipes();

        } else if (choice == 3) {
            // 개선: ReadLine 헬퍼로 중복 제거, 빈값 방어는 SearchByName 내부에서 처리
            std::string name = ReadLine("검색할 물약 이름: ");
            myWorkshop.SearchByName(name);

        } else if (choice == 4) {
            std::string ingredient = ReadLine("검색할 재료 이름: ");
            myWorkshop.SearchByIngredient(ingredient);

        } else if (choice == 5) {
            std::string name = ReadLine("지급할 물약 이름: ");
            myWorkshop.DispensePotionByName(name);

        } else if (choice == 6) {
            std::string ingredient = ReadLine("지급할 물약의 재료: ");
            myWorkshop.DispensePotionsByIngredient(ingredient);

        } else if (choice == 7) {
            std::string name = ReadLine("반환할 물약 이름: ");
            myWorkshop.ReturnPotionByName(name);

        } else if (choice == 8) {
            std::cout << "공방 문을 닫습니다..." << std::endl;
            break;

        } else {
            std::cout << "잘못된 선택입니다. 다시 시도하세요." << std::endl;
        }
    }

    return 0;
}
