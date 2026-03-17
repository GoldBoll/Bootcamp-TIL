#include <iostream>
#include <algorithm>
#include <windows.h>
using namespace std;

// =====================
// Item 클래스
// =====================
class Item
{
public:
    // Default Argument로 생성자 하나로 통합
    Item(const string& name = "", int price = 0) : name_(name), price_(price) {}

    string GetName()  const { return name_; }
    int    GetPrice() const { return price_; }

    void PrintInfo() const
    {
        cout << "[이름: " << name_ << ", 가격: " << price_ << "G]" << endl;
    }

private:
    string name_;
    int    price_;
};

// =====================
// 가격 비교 함수 (정렬용)
// =====================
inline bool compareItemsByPrice(const Item& a, const Item& b)
{
    return a.GetPrice() < b.GetPrice();
}

// =====================
// Inventory<T> 템플릿 클래스
// =====================
template <typename T>
class Inventory
{
public:
    // Default Argument로 생성자 하나로 통합 (기본 capacity = 5)
    Inventory(int capacity = 5)
        : capacity_(capacity), size_(0)
    {
        pItems_ = new T[capacity_];
    }

    // 복사 생성자: 깊은 복사
    Inventory(const Inventory<T>& other)
        : capacity_(other.capacity_), size_(other.size_), pItems_(nullptr)
    {
        pItems_ = new T[capacity_];
        for (int i = 0; i < size_; ++i)
        {
            pItems_[i] = other.pItems_[i];
        }
        cout << "인벤토리 복사 완료" << endl;
    }

    // 소멸자: 동적 배열 해제
    ~Inventory()
    {
        delete[] pItems_;
        pItems_ = nullptr;
    }

    // Assign 함수: 깊은 복사 대입
    Inventory<T>& Assign(const Inventory<T>& other)
    {
        if (this == &other)
            return *this;

        delete[] pItems_;

        capacity_ = other.capacity_;
        size_     = other.size_;
        pItems_   = new T[capacity_];
        for (int i = 0; i < size_; ++i)
        {
            pItems_[i] = other.pItems_[i];
        }
        cout << "인벤토리 Assign(깊은 복사) 완료" << endl;
        return *this;
    }

    // 아이템 추가 (가득 차면 자동으로 2배 확장)
    bool AddItem(const T& item)
    {
        if (size_ >= capacity_)
        {
            Resize(capacity_ * 2);
        }
        pItems_[size_] = item;
        size_++;
        return true;
    }

    // 마지막 아이템 제거
    bool RemoveLastItem()
    {
        if (size_ == 0)
        {
            cout << "[인벤토리] 비어있어 제거할 수 없습니다!" << endl;
            return false;
        }
        size_--;
        cout << "[인벤토리] 마지막 아이템이 제거되었습니다." << endl;
        return true;
    }

    // 전체 출력
    void PrintAllItems() const
    {
        if (size_ == 0)
        {
            cout << "비어있음" << endl;
            return;
        }
        for (int i = 0; i < size_; i++)
        {
            pItems_[i].PrintInfo();
        }
    }

    // 가격 오름차순 정렬
    void SortItems()
    {
        sort(pItems_, pItems_ + size_, compareItemsByPrice);
    }

    int GetCapacity() const { return capacity_; }
    int GetSize()     const { return size_; }

private:
    // 내부 자동 확장: 새 크기로 메모리 재할당 후 기존 데이터 복사
    void Resize(int newCapacity)
    {
        cout << "[인벤토리] 용량 확장: " << capacity_ << " -> " << newCapacity << endl;

        T* newItems = new T[newCapacity];       // 1. 새 메모리 할당
        for (int i = 0; i < size_; ++i)
        {
            newItems[i] = pItems_[i];           // 2. 기존 데이터 복사
        }
        delete[] pItems_;                       // 3. 기존 메모리 해제
        pItems_   = newItems;                   // 4. 포인터 교체
        capacity_ = newCapacity;                // 5. 용량 갱신
    }

    T*  pItems_;
    int capacity_;
    int size_;
};

// =====================
// main
// =====================
int main()
{
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);

    Inventory<Item> inv(5);

    inv.AddItem(Item("롱소드",    150));
    inv.AddItem(Item("체력 포션",  30));
    inv.AddItem(Item("마나 포션",  50));
    inv.AddItem(Item("전설의 검", 9999));
    inv.AddItem(Item("방패",      200));

    cout << "=== 원본 인벤토리 ===" << endl;
    inv.PrintAllItems();

    cout << "\n=== 가격순 정렬 후 ===" << endl;
    inv.SortItems();
    inv.PrintAllItems();

    // 자동 확장 테스트 (capacity 5 -> 10)
    cout << "\n=== 자동 확장 테스트 (6번째 아이템 추가) ===" << endl;
    inv.AddItem(Item("초과 아이템", 1));
    cout << "용량: " << inv.GetCapacity() << " / 현재 개수: " << inv.GetSize() << endl;
    inv.PrintAllItems();

    // RemoveLastItem 테스트
    cout << "\n=== RemoveLastItem 테스트 ===" << endl;
    inv.RemoveLastItem();
    cout << "제거 후 개수: " << inv.GetSize() << endl;
    inv.PrintAllItems();

    // 복사 생성자 테스트
    cout << "\n=== 복사 생성자 테스트 ===" << endl;
    Inventory<Item> inv2(inv);
    inv2.AddItem(Item("복사본 전용 아이템", 777));

    cout << "\n[원본]" << endl;
    inv.PrintAllItems();

    cout << "\n[복사본]" << endl;
    inv2.PrintAllItems();

    // Assign 함수 테스트
    cout << "\n=== Assign(깊은 복사) 테스트 ===" << endl;
    Inventory<Item> inv3;
    inv3.Assign(inv2);

    cout << "\n[inv3 - Assign 결과]" << endl;
    inv3.PrintAllItems();

    cout << "\n용량: " << inv.GetCapacity()
         << " / 현재 개수: " << inv.GetSize() << endl;

    cout << "* 아무 키나 누르면 종료됩니다...";
    cin.ignore();
    cin.get();
    return 0;
}
