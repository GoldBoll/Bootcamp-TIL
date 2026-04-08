#include <iostream>
#include <vector>
using namespace std;

long long sum(const vector<int>& v) {
    // 여기에 답안을 작성해주세요.

	long long sum = 0;

    for (int i = 0; i < v.size(); i++) {
		sum += v[i];
	}

	return sum;
}

int main() {
    vector<int> v{ 3, 6, 7, 9 };
    cout << sum(v) << "\\n"; // 25
}


2/

#include <iostream>
using namespace std;

class Rect {
	int width, height;
    // 여기에 답안을 작성해주세요.
public:
    Rect(int w, int h)
    {
        width = w;
		height = h;
    }
    int const area()
    {
		return width * height;
    }
    void setWidth(int num) 
    {
        if (num < 0) width = 0;
        else
            width = num;

    }
    void setHeight(int num)
    {
        if (num < 0) height = 0;
        else
            height = num;

    }
};

int main() {
    Rect r(3, 4);
    cout << r.area() << "\\n"; // 12
    r.setWidth(-5); r.setHeight(2);
    cout << r.area() << "\\n"; // 0
}

3/
#include <iostream>
using namespace std;

class Rect {
	int width, height;
    // 여기에 답안을 작성해주세요.
public:
    Rect(int w, int h)
    {
        width = w;
		height = h;
    }
    int const area()
    {
		return width * height;
    }
    void setWidth(int num) 
    {
        if (num < 0) width = 0;
        else
            width = num;

    }
    void setHeight(int num)
    {
        if (num < 0) height = 0;
        else
            height = num;

    }
};

int main() {
    Rect r(3, 4);
    cout << r.area() << "\\n"; // 12
    r.setWidth(-5); r.setHeight(2);
    cout << r.area() << "\\n"; // 0
}

4/
#include <iostream>
#include <string>
using namespace std;

class BankAccount {
private:
    string owner;
    double balance;

public:
    BankAccount(const string& name, double initial) {
        // 생성자 로직을 작성해주세요.
        // 생성자 매개변수 설명: 소유자 이름(name), 초기 잔액(initial)
		owner = name;
        if (initial < 0)
        {
            balance = 0;
        }
        else
        {
            balance = initial;
		}
    }

    void deposit(double amount) {
        // 입금 로직을 작성해주세요.
        if (amount > 0)
        {
            balance += amount;
        }
    }

    bool withdraw(double amount) {
        // 출금 로직을 작성해주세요.
        if (amount > balance) return false;
        balance -= amount;
        return true;
    }

    double getBalance() const {
        // 현재 잔액 반환 로직을 작성해주세요.
        return balance;
    }

    // 계좌 정보 출력하는 함수 (구현하실 필요 없음)
    void printInfo() const {
        cout << "Owner: " << owner << ", Balance: " << balance << " won\\n";
    }
};

int main() {
    BankAccount account("Alice", 1000);
    account.printInfo(); // Owner: Alice, Balance: 1000 won

    account.deposit(500);
    account.printInfo(); // Owner: Alice, Balance: 1500 won

    if (account.withdraw(2000)) {
        cout << "Withdraw OK!\\n"; // 이건 출력 안됨
    }
    else {
        cout << "Withdraw FAILED!\\n"; // 이것이 출력됨
    }

    if (account.withdraw(1000)) {
        cout << "Withdraw OK!\\n"; // 이것이 출력됨
    }

    account.printInfo(); // Owner: Alice, Balance: 500 won
}

5/
#include <iostream>
#include <vector>
using namespace std;

class Animal {
    // 여기에 Animal 내용 작성해주세요.
public:
    virtual void speak() { cout << "???\n"; };
};

// 여기에 Dog, Cat 클래스 작성해주세요.
class Dog : public Animal {
public:
    void speak() override { cout << "Woof\n"; }
};


class Cat : public Animal {
public:
    void speak() override { cout << "Meow\n"; }
};

int main() {
    vector<Animal*> zoo{ new Dog, new Cat, new Animal };
    for (auto p : zoo) p->speak(); // Woof / Meow / ???
    for (auto p : zoo) delete p;
}

6/
#include <iostream>
#include <string>
using namespace std;

template <typename T>
T get_max(T a, T b) {
    if (a > b) return a;
    else return b;
}

int main() {
    cout << get_max(10, 20) << "\\n";            // 20
    cout << get_max(3.14, 2.71) << "\\n";        // 3.14
    string s1 = "Apple", s2 = "Banana";
    cout << get_max(s1, s2) << "\\n";            // Banana
}

7/
#include <iostream>
using namespace std;

class IntPtr {
    int* ptr;
public:
    IntPtr(int val) {
        ptr = new int(val);
    }

    ~IntPtr() {
        // 여기에 소멸자 로직을 작성해주세요.
        delete ptr;
    }

    IntPtr(const IntPtr& other) {
        // 여기에 복사 생성자 로직을 작성해주세요.
        ptr = new int(*other.ptr);
    }

    int getValue() const {
        return *ptr;
    }
};

int main() {
    IntPtr p1(10);
    IntPtr p2 = p1; // 복사 생성자 호출

    cout << p1.getValue() << "\\n"; // 10
    cout << p2.getValue() << "\\n"; // 10
}

8/
#include <iostream>
#include <vector>
#include <set>

// 추가로 필요하다고 생각하는 헤더들은 여기다가 자유롭게 추가할 것
using namespace std;

vector<int> removeDuplicates(const vector<int>& v) {
    // 중복을 제거하고 순서를 유지한 벡터 반환
    // 예: [1,3,2,3,1,4] -> [1,3,2,4]
    vector<int> result;
    set<int> m_find;

    for (int i = 0; i < v.size(); i++)
    {
        if (m_find.find(v[i]) == m_find.end())
        {
            m_find.insert(v[i]);
            result.push_back(v[i]);
        }
    }


    
    return result;
}

int main() {
    vector<int> nums = { 1, 3, 2, 3, 1, 4, 2, 5 };
    vector<int> result = removeDuplicates(nums);

    cout << "Result: ";
    for (int n : result) {
        cout << n << " ";
    }
    cout << "\\n"; // 1 3 2 4 5
}

9/
#include <iostream>
#include <string>
#include <map>
// 추가로 필요하다고 생각하는 헤더들은 여기다가 자유롭게 추가할 것
using namespace std;

int getMinChangesToAnagram(const string& s1, const string& s2) {
    // 여기에 답안을 작성해주세요.
    
    if (s1.size() != s2.size()) return -1;
    map<char, int> check;

    for (int i = 0; i < s1.size(); i++)
    {
        check[s1[i]]++;
    }
    for (int i = 0; i < s2.size(); i++)
    {
        check[s2[i]]--;
    }

    int count = 0;

    for (pair<char, int> check2 : check)
    {
        if (check2.second > 0) count += check2.second;
    }


    return count;
}

int main() {
    cout << "listen -> silent: " << getMinChangesToAnagram("listen", "silent") << "\\n"; // 0
    cout << "abc -> abd: " << getMinChangesToAnagram("abc", "abd") << "\\n"; // 1
    cout << "aabbcc -> aabdde: " << getMinChangesToAnagram("aabbcc", "aabdde") << "\\n"; // 3
    cout << "abc -> xyz: " << getMinChangesToAnagram("abc", "xyz") << "\\n"; // 3
    cout << "ab -> abc: " << getMinChangesToAnagram("ab", "abc") << "\\n"; // -1
    cout << "test -> test: " << getMinChangesToAnagram("test", "test") << "\\n"; // 0
}

10/
#include <iostream>
#include <string>
#include <map>
#include <vector>

using namespace std;

struct Item
{
    string name;
    int attackPower;
    int rarity;

    // TODO: 요구사항에 맞는 비교 연산자 구현
    bool operator<(const Item& other) const
    {
        // [작성란]
        if (attackPower != other.attackPower)
        {
            return attackPower > other.attackPower;
        }
        if (rarity != other.rarity)
        {
            return rarity < other.rarity;
        }
        return name < other.name;
    }
};

// TODO: 조건부 삽입 및 가격 갱신 함수 구현
void tryInsert(map<Item, int>& shop, const Item& item, int price)
{
    // [작성란]
    if (item.attackPower < 50) return;

    auto _item = shop.find(item);
    if (_item == shop.end())
    {
        shop[item] = price;
    }
    else
    {
        if (price > _item->second)
        {
            _item->second = price;
        }
    }

}

int main()
{
    map<Item, int> shop;

    tryInsert(shop, { "Excalibur",      100,    1 }, 5000);
    tryInsert(shop, { "Dragon Sword",   100,    2 }, 4500);
    tryInsert(shop, { "Wooden Sword",   20,     5 }, 100);
    tryInsert(shop, { "Excalibur",      100,    1 }, 5200);
    tryInsert(shop, { "Excalibur",      100,    1 }, 4800);

    cout << "--- 상점 아이템 목록 (정렬 및 갱신 결과) ---\n";
    for (const auto& kv : shop)
    {
        const Item& item = kv.first;
        int price = kv.second;

        cout << item.name << " [ATK: " << item.attackPower
            << ", Rarity: " << item.rarity << "] : Price(" << price << ")\n";
    }

    return 0;

    /*결과 확인
        -- 상점 아이템 목록(정렬 및 갱신 결과) -- -
        Excalibur[ATK:100, Rarity : 1] : Price(5200)
        Dragon Sword[ATK:100, Rarity : 2] : Price(4500)*/
}

11.
#include <iostream>
#include <string>

template <typename T>
class MyVector
{
private:
    T* Data;      // 동적 배열 포인터
    int Size;     // 현재 데이터 개수
    int Capacity; // 현재 최대 수용량

public:
    // [문제 1] 생성자 (3점)
    // 초기 용량(InCapacity)만큼 메모리를 할당하고 변수들을 초기화하세요.
    MyVector(int InCapacity = 2)
    {
        // 로직 작성
        Capacity = InCapacity;
        Size = 0;
        Data = new T[Capacity];
    }

    ~MyVector()
    {
        if (Data) delete[] Data;
    }

    // [문제 2] Add 함수 (12점)
    // 1. 만약 배열이 가득 찼다면(Size == Capacity), 용량을 2배로 늘려야 합니다.
    // 2. 새로운 메모리를 할당하고 기존 데이터를 안전하게 이사시킨 뒤, 이전 메모리를 해제하세요.
    // 3. 마지막에 새로운 데이터를 추가하세요.
    void Add(const T& InData)
    {
        // 로직 작성 (메모리 재할당 프로세스 포함)
        if (Size == Capacity)
        {
            Capacity *= 2;
            T* newData = new T[Capacity];
            for (int i = 0; i < Size; i++)
            {
                newData[i] = Data[i];
            }
            delete Data;
            Data = newData;
        }
        Data[Size] = InData;
        Size++;
    }

    // [문제 3] operator[] 오버로딩 (5점)
    // 인덱스를 통해 데이터를 참조형으로 반환하세요.
    T& operator[](int Index)
    {
        // 로직 작성
        return Data[Index];
    }

    int GetSize() const { return Size; }
    int GetCapacity() const { return Capacity; }
};

int main()
{
    // 테스트: 초기 용량은 2지만, 3개를 넣어서 재할당이 일어나는지 확인합니다.
    MyVector<int> Vec;
    Vec.Add(10);
    Vec.Add(20);

    std::cout << "Before Resize - Size: " << Vec.GetSize() << ", Capacity: " << Vec.GetCapacity() << std::endl;
    std::cout << "Data: " << Vec[0] << ", " << Vec[1] << std::endl;

    Vec.Add(30); // 여기서 재할당 로직이 실행되어야 함

    std::cout << "After Resize - Size: " << Vec.GetSize() << ", Capacity: " << Vec.GetCapacity() << std::endl;
    std::cout << "Data: " << Vec[0] << ", " << Vec[1] << ", " << Vec[2] << std::endl;

    return 0;
}