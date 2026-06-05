---
title: "[TIL] 2026-06-04 — UStruct vs UClass(CS 34) + 알고리즘 심화: map·set·문자열·스택"
date: 2026-06-04 21:00:00 +0900
categories: ["TIL", "CS"]
tags: ["til", "mock-interview", "ue5", "cpp", "uobject", "ustruct", "uclass", "reflection", "gc", "struct", "class", "algorithm", "stl", "map", "set", "stack", "string", "simulation", "greedy"]
render_with_liquid: false
---

> 오늘은 CS 트랙이 네트워크에서 언리얼 오브젝트 시스템으로 넘어간 둘째 날. CS 33(UObject) 모의면접 발표를 마치고, 그 위에서 갈라지는 **CS 34 "UStruct vs UClass"** 준비 파일을 작성했다. 핵심은 **UObject 상속 여부 하나가 GC 대상·값/참조 타입·리플렉션 범위를 모두 가른다**는 것. 오후 알고리즘 심화수업에서는 `map`/`set`·문자열 인덱싱·스택 7문제를 풀며 **`문자 - 기준문자`로 문자를 배열 인덱스로 바꾸는 변환**이 거의 모든 문제를 관통함을 정리했다.

## 오늘 한 일 요약

1. **CS 33 UObject 모의면접 발표** — 네트워크(30~32) 트랙을 닫고 언리얼 오브젝트 시스템 트랙의 첫 발표. UObject = 리플렉션·GC·직렬화·CDO의 최상위 토대.
2. **CS 34 "UStruct vs UClass" 준비 파일 작성** — UObject 상속 여부에서 갈라지는 GC 대상·값/참조 타입·리플렉션 범위·접두사(F vs U/A)·선택 기준을 정리.
3. **알고리즘 심화수업 7문제** — 숫자 카드(map)·회사 사람(set)·첫끝 글자·숫자의 합·알파벳 찾기·다이얼(구현 vs 그리디)·괄호(스택 vs 카운터). 인덱스 변환 관용구가 관통.
4. **알고리즘 심화 과제** — 백준 2852 'NBA 농구'(이기던 시간 합산 시뮬레이션) 풀어 구글 폼 제출.

## 1. CS 33 UObject 모의면접 발표 — 네트워크→언리얼 전환점

직전(06-02)에 네트워크 트랙의 마지막인 방화벽(CS 32)을 발표하고, 이날 **CS 33 UObject**를 발표하며 CS 주제가 네트워크 → 언리얼 오브젝트 시스템으로 전환됐다. 발표의 뼈대는 다음과 같았다.

- **UObject = 언리얼이 관리하는 모든 객체의 최상위 베이스** — 리플렉션·가비지 컬렉션(GC)·직렬화·에디터 통합의 토대.
- **리플렉션** — `UCLASS`/`UPROPERTY`/`UFUNCTION` 매크로를 UHT(Unreal Header Tool)가 빌드 전에 파싱해 메타데이터 코드를 생성한다. 런타임에 타입·멤버·함수 정보를 조회할 수 있는 근거.
- **GC** — mark-and-sweep. "도달 가능성"으로 살아있는지 판정하며, **`UPROPERTY`로 표시된 UObject 참조만 GC가 추적**한다. raw 포인터는 GC가 못 봐 댕글링 위험.
- **CDO(Class Default Object)** — 각 UClass마다 하나씩 존재하는 기본값 인스턴스. 새 인스턴스의 초기값 원본.

이 발표가 메인인 CS 34의 출발점이 됐다 — "UObject란 무엇인가"를 정리했으니, 다음은 "그래서 UObject로 만들 것(UCLASS)과 만들지 않을 것(USTRUCT)을 어떻게 가르는가"다.

## 2. CS 34 — UStruct vs UClass (오늘의 메인)

CS 33(UObject) 위에서 데이터를 담는 그릇을 둘로 나누는 기준을 정리했다.

### 핵심 직관

> **UCLASS는 "엔진(GC)이 수명을 관리하는 살아있는 참조 객체"(접두사 U/A), USTRUCT는 "값처럼 복사되어 다니는 GC 밖의 가벼운 데이터 묶음"(접두사 F).**

`FVector`·`FRotator`·`FHitResult` 같은 수학·결과 타입이 USTRUCT인 이유가 여기 있다 — 좌표 하나에 UClass 등록·GC 추적·힙 할당 비용을 얹으면 매 프레임 수천 개의 GC 대상이 생겨 성능이 무너진다. 반대로 캐릭터·아이템·매니저처럼 수명·정체성·에디터 노출·블루프린트 함수 호출이 필요한 객체는 UCLASS로 만든다.

### 결정적 차이 ① GC 대상 여부 (가장 중요)

```
UCLASS (UObject 파생):
  생성  NewObject<T>() / SpawnActor<T>()  → 힙
  수명  GC가 mark-and-sweep으로 관리 → 비결정적 수명
  소멸  직접 delete X — Destroy()로 회수 표시, 실제 회수는 GC
  → "도달 가능성"으로 판정 (UPROPERTY 참조 추적)

USTRUCT (UObject 아님):
  생성  값으로 — 스택 변수·다른 객체의 멤버·컨테이너 원소
  수명  자신을 품은 스코프/객체와 운명 공유 → 결정적 수명
  소멸  스코프 끝나면 자동 (일반 C++ 값처럼)
  → GC의 mark-and-sweep 대상이 아님
```

수명을 **누가 관리하느냐**가 갈리는 게 핵심. 면접에서 "struct는 가볍고 class는 무겁다"로 끝나면 부족하고, **GC·수명·직렬화·네트워크 관점에서 왜 갈리는가**를 풀어내야 한다.

### 결정적 차이 ② 값 타입 vs 참조 타입

```cpp
// USTRUCT — 값 타입: 복사되고 독립
FVector A(1, 0, 0);
FVector B = A;      // 통째 복사 — A, B는 서로 다른 별개 값
B.X = 5;            // A.X는 1 그대로

// UCLASS(UObject) — 참조 타입: 포인터로만 다룸
AItem* P = GetWorld()->SpawnActor<AItem>();
AItem* Q = P;       // 같은 객체를 가리킴 (복사 아님)
Q->Destroy();       // P가 가리키던 객체도 사라짐
```

USTRUCT는 **"값이 곧 데이터"**(좌표·색·결과), UObject는 **"정체성 있는 객체"**(이 캐릭터, 저 아이템). 두 좌표가 같은 값이면 같은 것으로 취급해도 되지만, 두 캐릭터는 같은 값(체력·위치)을 가져도 별개의 객체다.

### 결정적 차이 ③ 리플렉션 범위 — UFUNCTION을 붙일 수 있나

```
USTRUCT:  UPROPERTY ⭕ (변수 리플렉션·직렬화·에디터 노출)
          UFUNCTION ❌ (블루프린트 함수 노출 불가)
          일반 C++ 멤버 함수 ⭕ (FVector::Size() 등 — C++ 내부에서는 자유)

UCLASS:   UPROPERTY ⭕ + UFUNCTION ⭕ (변수·함수 모두 블루프린트 노출)
```

USTRUCT는 "동작 없는 데이터 컨테이너" 성격이라 멤버 함수는 C++에서 얼마든지 쓰되 블루프린트 노드로 내보내지는 못한다. 구조체 동작을 블루프린트에 노출하려면 `UBlueprintFunctionLibrary`(UCLASS)에 `static UFUNCTION`을 만들어 그 구조체를 인자로 받게 우회한다.

### GC 통로 — USTRUCT 안의 UObject 포인터

USTRUCT 자체는 GC 대상이 아니지만, **안의 `UPROPERTY` UObject 포인터는 GC가 따라간다.** CS 33의 "UPROPERTY 참조만 GC가 본다"가 구조체 멤버에도 그대로 적용된다.

```cpp
USTRUCT(BlueprintType)
struct FWeaponData
{
    GENERATED_BODY()

    UPROPERTY()
    UStaticMesh* WeaponMesh = nullptr;  // GC가 추적 → 구조체 사는 동안 보호

    UPROPERTY()
    float Damage = 0.f;

    // raw 포인터로 두면(UPROPERTY 없이) GC가 못 봐 댕글링 위험
    // UTexture* RawIcon;   // ❌ 위험
};
```

즉 USTRUCT는 GC가 회수하는 대상은 아니지만, **그 안의 UObject 참조를 GC가 따라가는 통로** 역할을 한다.

### 직렬화·네트워크 관점

둘 다 `UPROPERTY` 목록 기반 자동 직렬화지만 **단위**가 다르다. UCLASS는 독립된 직렬화 단위(`.uasset`·`USaveGame`·네트워크 Actor 리플리케이션의 객체 단위), USTRUCT는 보통 UObject의 멤버로 함께 저장된다. 네트워크에서는 USTRUCT가 값 타입이라 여러 값을 묶어 보내기 좋고, `NetSerialize()`를 직접 구현해 대역폭을 최적화할 수 있다(`FVector_NetQuantize` 등). 30~32번 네트워크에서 본 패킷·대역폭 효율 고민이 여기서 다시 등장한다.

### 언제 무엇을 쓰나 — 선택 기준

```
UCLASS (UObject) — 다음 중 하나라도 필요할 때:
  · 수명을 엔진(GC)이 관리해야 함
  · 정체성 있는 객체 (이 캐릭터·저 아이템)
  · 블루프린트에 함수(UFUNCTION) 노출
  · 폴리모픽 상속·가상 함수
  · 월드 배치(AActor)·컴포넌트(UActorComponent)
  예: ACharacter, AItem, UInventoryComponent, USaveGame

USTRUCT (F-구조체) — 다음에 해당할 때:
  · 값으로 복사되는 가벼운 데이터
  · 자주 생성·소멸되는 임시/결과 데이터 (GC 비용 회피)
  · 동작보다 데이터가 본질
  · 블루프린트 변수/핀으로 묶어 다룰 데이터 (BlueprintType)
  예: FVector, FRotator, FHitResult, FDamageInfo
```

판단 한 줄 — **"이게 살아있는 객체인가(UCLASS), 아니면 떠다니는 값인가(USTRUCT)?"**

### 표준 C++ class vs struct와의 차이

표준 C++의 class/struct는 **기본 접근 지정자(private vs public)·기본 상속 방식** 두 가지만 다르고 기능은 동일했다. 반면 언리얼의 UCLASS/USTRUCT는 **GC 대상 여부·타입 의미론(참조 vs 값)·리플렉션 범위(UFUNCTION 가능 여부)** 까지 본질적으로 다른 도구다. 표준 C++의 구분이 "관용·스타일"의 문제였다면, 언리얼에서는 "엔진이 이 데이터를 어떻게 취급할지"를 정하는 **구조적 결정**으로 무게가 커졌다.

### 비교 표 총정리

| 항목 | USTRUCT | UCLASS |
|---|---|---|
| UObject 상속 | ❌ 아님 | ⭕ UObject 파생 |
| 접두사 | **F** | **U** (월드 배치는 **A**) |
| GC 대상 | ❌ 비대상 (값으로 소멸) | ⭕ GC가 수명 관리 |
| 타입 의미론 | 값 타입 (복사) | 참조 타입 (포인터) |
| 정체성 | 값 자체가 의미 | 객체 정체성 있음 |
| 생성 | 값으로 (스택·멤버·원소) | NewObject / SpawnActor |
| 소멸 | 스코프 종료 시 자동 | Destroy() 표시 → GC 회수 |
| UPROPERTY | ⭕ (변수 리플렉션) | ⭕ |
| UFUNCTION | ❌ 불가 | ⭕ (블루프린트 함수 노출) |
| 메타데이터 | UScriptStruct (CDO 없음) | UClass + CDO |
| 직렬화 단위 | UObject 멤버로 함께 | 독립 단위(.uasset·세이브·Actor) |
| 네트워크 | NetSerialize 커스텀 가능 | Actor 프로퍼티 리플리케이션 |
| 폴리모픽 상속 | 제한적 (값 확장 수준) | UObject 계층 다형성 ⭕ |
| 대표 예 | FVector, FHitResult, FDamageInfo | ACharacter, AItem, UMyComponent |
| 비용 | 가벼움 | UClass 등록·GC 추적·힙 할당 |

## 3. 알고리즘 심화 — map·set·문자열·스택 7문제

오후 심화반에서 자료구조(map·set) → 문자열 인덱스 변환 → 스택 흐름으로 7문제를 풀었다. **관통하는 아이디어: `문자 - 기준문자`(`c - '0'`, `c - 'a'`, `c - 'A'`)로 문자를 배열 인덱스로 바꾸는 변환**이 거의 모든 문제에서 재등장했다.

### 3.1 숫자 카드 (백준 10815) — map

상근이가 가진 카드를 등록하고, 질의마다 존재 여부를 0/1로 출력.

```cpp
map<int, bool> m;
for (int i = 0; i < n; i++) { int a; cin >> a; m[a] = true; }
// 질의
cout << m.count(b) << ' ';   // 있으면 1, 없으면 0
```

- **`map::count(key)`** 는 key가 있으면 1, 없으면 0 — 출력 형식과 그대로 일치해 `if` 불필요.
- map은 RB-Tree라 삽입·조회 O(log N). 값 범위가 -1000만~1000만이라 배열 인덱싱은 부담 → map/set이 자연스럽다.
- 존재 여부만 필요하면 `set`이 더 정석, `unordered_map`/`unordered_set`은 평균 O(1)로 더 빠르다.

### 3.2 회사에 있는 사람 (백준 7785) — set + 역순 출력

enter면 등록, leave면 제거. 마지막에 남은 사람을 사전 역순으로 출력.

```cpp
set<string> s;
if (s2 == "enter") s.insert(s1);
else               s.erase(s1);
// 역순 출력
for (auto it = s.rbegin(); it != s.rend(); ++it)
    cout << *it << endl;
```

- `set`은 오름차순 자동 정렬 → **`rbegin()`/`rend()`로 뒤에서부터** 순회하면 역순 출력이 공짜.
- **`*it`(set) vs `it->first`(map)**: set 원소는 값 하나(string)라 `*it`. map은 원소가 `pair`라 `it->first`(키)·`it->second`(값).
- **`++it` vs `it++`**: for 증감식에선 반환값을 안 쓰므로 결과 동일. 후위(`it++`)는 복사본을 만들어 객체 반복자에서 손해 → 관용적으로 전위(`++it`) 권장.

### 3.3 첫 글자 + 마지막 글자 — 문자열 인덱싱

```cpp
while (t--) {
    string s; cin >> s;
    cout << s.front() << s.back() << endl;   // = s[0], s[s.size()-1]
}
```

- **`while (t--)`**: 현재 t를 조건으로 쓰고(후위) 1 감소 → T번 정확히 반복. `while(--t)`는 T-1번이라 부족.
- `front()`/`back()` ↔ `s[0]`/`s[s.size()-1]` 동일.

### 3.4 숫자의 합 (백준 11720) — 문자→숫자 변환

숫자들이 공백 없이 붙어 들어옴. 자릿수가 매우 길 수 있어 **문자열로 받아** 각 자리를 더한다.

```cpp
int sum = 0;
for (int i = 0; i < n; i++) sum += s[i] - '0';   // 문자 → 숫자
```

- **`s[i] - '0'`**: `'5'`(아스키 53) - `'0'`(48) = 5. 정수형으로 받으면 오버플로로 틀린다. 문자열은 길이 무관하게 안전.

### 3.5 알파벳 찾기 (백준 10809) — 배열 vs find+캐스팅

a~z 각 알파벳이 처음 등장하는 위치, 없으면 -1.

```cpp
// (A) 배열 방식
int a[26]; for (int i = 0; i < 26; i++) a[i] = -1;
for (int i = 0; i < (int)s.size(); i++) {
    int idx = s[i] - 'a';            // 'a'~'z' → 0~25
    if (a[idx] == -1) a[idx] = i;    // 처음 등장할 때만 기록
}

// (B) find + (int) 캐스팅 트릭
cout << (int)s.find(alpa[i]) << ' ';
```

- `string::find`는 못 찾으면 **`npos`**(unsigned long long 최댓값) 반환. `(int)`로 캐스팅하면 비트가 잘려 **-1**이 되어 "없으면 -1"이 if 없이 해결.
- ⚠️ 캐스팅 없이 `if (s.find(x) == -1)`로 비교하면 틀린다(unsigned 비교). `(int)` 캐스팅 또는 `== string::npos`로 비교해야 한다.

### 3.6 다이얼 (백준 5622) — 구현(시뮬레이션) vs 그리디

옛날 다이얼 전화기: 숫자 n을 돌리는 데 n+1초. 각 알파벳의 다이얼 숫자를 찾아 시간 합산.

```cpp
// 룩업 테이블에 "최종 초"를 직접 저장 (권장)
int a[26] = { 3,3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,8,9,9,9,10,10,10,10 };
int sum = 0;
for (char c : s) sum += a[c - 'A'];
```

- P~S(4개)는 8초, W~Z(4개)는 10초라 각각 4번씩 → 총 26칸. 다이얼 숫자를 저장하고 `+1`하기보다 **최종 답을 미리 테이블에 박아두면** 변환 단계가 사라진다.
- **그리디와 헷갈리는 점** — 그리디는 선택지가 있고 최적을 *찾아야* 하며 정당성 증명이 필요(거스름돈·회의실 배정). 다이얼은 각 글자의 숫자가 고정 → 선택 없음. 규칙대로 변환·합산하는 **구현(시뮬레이션)** 문제. 판별 기준: **"무엇을 고를지 고민되면 그리디, 규칙대로 변환·합산이면 구현."**

### 3.7 괄호 (백준 9012) — 스택 vs 카운터

VPS(올바른 괄호 문자열) 판정.

```cpp
// 스택 방식
stack<char> s;
for (char c : str) {
    if (c == '(') s.push(c);
    else {
        if (!s.empty() && s.top() == '(') s.pop();
        else return "NO";          // 닫을 게 없는데 ')'
    }
}
return s.empty() ? "YES" : "NO";   // 다 짝지어졌으면 YES
```

- ⚠️ 마지막 검사는 입력 `str`이 아니라 **스택 `s`** 의 `empty()` — `str.empty()`로 쓰면 항상 NO가 나오는 버그(변수명 혼동 주의).
- **카운터(balance) 방식** — 괄호가 한 종류라 스택에 쌓이는 게 전부 `(`로 동일 → 개수만 세면 됨. `balance++/--`, `balance < 0`이면 NO, 끝에 `balance == 0`이면 YES. push/pop을 숫자 하나로 압축, 메모리 O(1).
- **4949 균형잡힌 세상과의 차이** — `()`와 `[]` 두 종류라 "가장 최근에 연 괄호와 짝이 맞는지"를 봐야 함 → **스택 필수**(카운터로는 불가).

| | 9012 괄호 | 4949 균형잡힌 세상 |
|---|---|---|
| 괄호 종류 | 1종 | 2종 |
| 풀이 | 카운터로 충분 | 스택 필요 |

### 심화 과제

- **백준 2852 'NBA 농구'** — 두 팀의 득점 시각을 보고 각 팀이 이기고 있던 시간의 총합을 구하는 시뮬레이션. 풀어서 구글 폼 제출.

## 4. C++ 문법 메모 (오늘 짚은 것)

- **`#define endl '\n'`** — `std::endl`은 줄바꿈+flush라 느림. `'\n'`은 flush 없이 줄바꿈만 → 빠름.
  - ⚠️ `#define endl '\n';`처럼 **세미콜론을 넣으면 안 됨**. `cout << endl << x;`가 `cout << '\n'; << x;`로 깨진다.
- **`map::count`** = 0 또는 1 (중복 불가).
- **`*it`(set) vs `it->first`/`it->second`(map)**.
- **`++it` vs `it++`** — 결과 같을 땐 전위 권장(복사 비용).
- **`while (t--)`** = T번 반복 관용구.
- **인덱스 변환 관용구**: `c - '0'`(숫자), `c - 'a'`/`c - 'A'`(알파벳).
- **`string::npos` + `(int)` 캐스팅** = -1.

## 오늘 배운 것 정리

1. **UStruct vs UClass는 UObject 상속 여부에서 모든 게 갈린다** — GC 대상(UCLASS)/비대상(USTRUCT), 참조 타입/값 타입, UFUNCTION 가능/불가가 전부 이 한 축에서 파생된다. "struct는 가볍고 class는 무겁다"가 아니라 **수명을 누가 관리하나**가 본질.
2. **F vs U/A 접두사는 GC 대상 여부를 이름에 박아둔 것** — `FVector`(값·복사)와 `UStaticMeshComponent`(GC 관리 객체)를 보면 접두사만으로 성격이 드러난다.
3. **USTRUCT는 GC 통로** — 구조체 자체는 GC 비대상이지만 안의 `UPROPERTY` UObject 포인터는 GC가 추적한다. raw 포인터로 두면 댕글링 위험(CS 33 규칙 그대로).
4. **인덱스 변환 관용구가 알고리즘을 관통** — `c - '0'`/`c - 'a'`/`c - 'A'`로 문자를 0-기반 인덱스로 바꾸는 게 카드·알파벳 찾기·다이얼·숫자의 합을 모두 관통했다.
5. **구현 vs 그리디 판별** — "무엇을 고를지 고민되면 그리디, 규칙대로 변환·합산이면 구현(시뮬레이션)." 다이얼은 선택지가 없어 구현 문제.
6. **괄호 1종은 카운터, 2종은 스택** — 종류가 하나면 개수만 세는 카운터로 O(1) 메모리에 풀리지만, 두 종류 이상이면 "최근에 연 괄호"를 봐야 해 스택이 필수다.
