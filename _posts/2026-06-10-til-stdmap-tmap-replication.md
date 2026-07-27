---
title: "std::map vs TMap 자료구조 비교"
subtitle: "TMap이 실제로는 unordered_map에 가까운 이유"
date: 2026-06-10 19:30:00 +0900
categories: ["CS", "자료구조"]
tags: ["til", "mock-interview", "cs", "map", "hash", "stl", "ue5", "cpp", "replication", "rpc", "network", "reflection", "gc", "netrole", "algorithm", "simulation"]
render_with_liquid: false
description: "TMap을 std::map에 대응시켜 이해하고 있었는데 답변으로 정리하다 그 대응이 틀렸다는 게 드러났다. 자료구조·복잡도·순회 순서·메모리 레이아웃·균형 규칙 다섯 축으로 갈라 비교했다."
image: /assets/img/thumbs/til.svg
---

언리얼의 `TMap`을 C++의 `std::map`에 대응시켜 이해하고 있었는데, 면접 답변으로 정리하다 보니 그 대응이 틀렸다는 게 드러났다. 이 글에서는 두 컨테이너를 다섯 축 — 자료구조, 복잡도, 순회 순서, 메모리 레이아웃, 균형 규칙 — 으로 갈라 비교하며, **`TMap`이 실제로는 `std::unordered_map` 쪽에 가깝다는 결론**에 이른 과정을 이야기하려 한다.

같은 날 함께 준비한 언리얼 Replication 정리와 코드카타 풀이는 이 글의 주제와 달라 덜어냈다. Replication은 [복제 조절 5속성](/posts/til-unreal-multiplayer-ch5-7/), 코드카타는 [프로그래머스 161990](/posts/algo-2026-06-10-1/)에 정리돼 있다.

## 1. CS 37 모의면접 답변 보강 — std::map vs TMap (RBT)

어제 작성한 37번 파일을 모의면접에서 실제로 말할 수 있게 답변 라인으로 다듬었다. 핵심은 **"둘 다 맵이고요…"로 나열하지 않고, 트리/해시라는 내부 구조가 정렬·복잡도·통합까지 어떻게 연쇄로 갈라놓는지"** 를 한 흐름으로 푸는 것이다.

답변의 뼈대는 다섯 축이다.

| 축 | std::map | TMap |
|---|---|---|
| 자료구조 | 레드블랙 트리 (균형 BST) | 해시 테이블 (TSet\<TPair\> 기반) |
| 복잡도 | O(log n) **최악 보장** | 평균 O(1), 최악 O(n)(충돌·리해시) |
| 순회 순서 | 키 오름차순 (결정적) | 해시/삽입 순 (의미 없음) |
| 메모리 레이아웃 | 노드 힙에 흩어짐 (캐시 나쁨) | 연속 sparse array (캐시 친화적) |
| 키 요구사항 | `operator<` (순서) | `GetTypeHash` + `operator==` |

한 줄 요약은 **"std::map은 정렬을 유지하는 트리, TMap은 빠른 조회를 노리는 해시 테이블"** 이다. 여기에 언리얼 통합(UPROPERTY 직렬화·복제·GC 추적)이 TMap에만 붙는다는 점을 마지막에 얹으면 "왜 언리얼 게임플레이 코드는 거의 항상 TMap인가"가 자연스럽게 닫힌다.

```cpp
std::map<std::string, int> Scores;
Scores["alice"] = 100;             // 삽입 O(log n), 트리에 정렬 위치 찾아 넣음
for (auto& [k, v] : Scores) { }    // 순회 = 키 오름차순 (정렬 보장)
auto lb = Scores.lower_bound("a"); // 범위 조회 O(log n) (정렬 덕분)

TMap<FName, AActor*> Spawned;
Spawned.Add(TEXT("Goblin_01"), Actor);            // 키 해시 → 버킷, 평균 O(1)
for (const TPair<FName, AActor*>& Kv : Spawned) { } // 순서 = 해시/삽입 순
```

## 2. 레드블랙 트리가 std::map의 O(log n)을 보장하는 방식

면접에서 "왜 std::map이 항상 O(log n)인가"를 물으면, 단순 BST의 퇴화부터 시작해야 답이 산다. 정렬된 키(1,2,3,4,5)를 순서대로 넣으면 단순 BST는 한쪽으로 쏠려 사실상 연결 리스트가 되고 탐색이 O(n)으로 퇴화한다. 레드블랙 트리는 이를 막는 자기 균형 BST다.

```
5가지 불변식:
 ① 모든 노드는 빨강 또는 검정
 ② 루트는 검정
 ③ 모든 리프(NIL)는 검정
 ④ 빨강 노드의 자식은 검정 (빨강 연속 금지)
 ⑤ 임의 노드 → 후손 리프까지 경로의 검정 노드 수 동일 (black height)
    → ④·⑤가 "최장 경로 ≤ 최단 경로의 2배"를 강제 → 높이 ≤ 2·log(n+1)
```

핵심은 4번과 5번이 함께 작동한다는 점이다. 빨강이 연속될 수 없고(④) 모든 경로의 검정 노드 수가 같으므로(⑤), 가장 긴 경로(빨강-검정 교대)도 가장 짧은 경로(전부 검정)의 2배를 넘지 못한다. 그래서 트리 높이가 항상 2·log(n+1) 이하로 묶여 모든 연산이 O(log n)이 된다.

이 규칙을 삽입·삭제 때 유지하는 방식이 동작의 핵심이다. **새 노드는 항상 빨강으로 삽입**한다 — 검정으로 넣으면 곧장 black height(⑤)가 깨지지만, 빨강은 위반 가능성이 더 다루기 쉽기 때문이다. 삽입 후 부모도 빨강이면 ④가 깨지는데, 이때 **삼촌 노드의 색**을 보고 두 갈래로 복구한다.

- **삼촌이 빨강** → 색만 바꾸는 **리컬러링(recoloring)** 으로 위반을 위로 올려보낸다.
- **삼촌이 검정** → **회전(rotation)** 으로 구조를 재배치한 뒤 색을 맞춘다. 회전은 BST 정렬 순서(왼쪽<부모<오른쪽)를 유지하며 부모-자식 관계만 바꾼다.

한 번의 삽입·삭제에서 회전은 상수 번(최대 2~3회)이면 끝나므로 균형 복구 비용까지 합쳐도 O(log n)이다. AVL보다 균형이 약간 느슨한 대신 회전이 적어 삽입·삭제가 잦은 워크로드에 유리해 STL이 채택했다.

## 3. TMap은 std::map보다 std::unordered_map에 가깝다

모의면접에서 이해도를 드러내는 한 수는 **"TMap은 std::map보다 std::unordered_map에 가깝다"** 고 짚는 것이다. std::map↔TMap의 "트리 vs 해시" 대비는, 표준 안에서 보면 std::map↔std::unordered_map 대비와 정확히 같은 축이고, TMap은 거기에 엔진 통합을 얹은 것일 뿐이다.

```
std::map           레드블랙 트리   정렬 유지   O(log n)            ← TMap의 "정렬" 대척점
std::unordered_map 해시 테이블    순서 없음   평균 O(1)            ← TMap과 같은 해시 계열
TMap               해시 테이블(TSet) 순서 없음   평균 O(1) + 언리얼 통합
```

TMap의 내부 구조는 std::unordered_map과도 살짝 다르다. 키-값 쌍(`TPair`)을 **`TSparseArray`라는 연속 배열**에 담고, 그 위에 키 해시 → 요소 인덱스를 가리키는 **`TSet`의 해시 버킷**을 따로 얹은 구조다. 값을 버킷 슬롯에 직접 넣는 open addressing이 아니라, 연속 배열 + 해시 인덱스 + 충돌 시 체이닝이다. 요소가 한 배열에 모여 있어 순회가 캐시 친화적이다.

언리얼 통합이 결정적 차이다. TMap에 `UPROPERTY()`를 붙이면 (1) 직렬화(.uasset 저장/로드) (2) 네트워크 복제 (3) 에디터 디테일 패널 노출 (4) 값이 `UObject*`면 GC 추적 — 이 넷이 따라온다. std::map은 표준 컨테이너라 리플렉션·GC가 인식하지 못하고, 안에 `UObject*`를 raw로 담으면 GC가 모르고 수거해 댕글링이 된다. **그래서 언리얼에서 UObject 키/값을 담는 맵은 반드시 TMap + UPROPERTY** 다.

```cpp
UPROPERTY()
TMap<FName, AActor*> Tracked;   // 값 AActor* → GC가 추적 (댕글링 방지)
```

리해시도 "해시 vs 트리"가 갈리는 지점이다. 해시 컨테이너(TMap·unordered_map)는 로드 팩터가 임계를 넘으면 버킷을 늘리고 전체 키를 재배치하는 리해시가 일어나 O(n) 비용이 한 번에 튄다. 크기를 알면 `Reserve`로 미리 잡아 회피한다. std::map(RBT)은 회전·리컬러링으로 국소 균형만 맞출 뿐 전체 재배치가 없어 비용이 균일하게 O(log n)이다.

## 정리 — 두 map을 가르는 축

1. **std::map vs TMap은 "트리 vs 해시"가 모든 차이를 가른다.** 정렬 유지·O(log n) 최악 보장·범위 조회는 RBT에서, 평균 O(1)·순서 없음·캐시 친화는 해시 테이블에서 나온다. 면접에선 내부 구조 → 정렬 → 복잡도 → 통합으로 연쇄를 풀어야 한다.
2. **RBT의 O(log n)은 4·5번 불변식의 합작이다.** 빨강 연속 금지 + black height 동일이 "최장 경로 ≤ 최단 경로의 2배"를 강제해 높이를 2·log(n+1) 이하로 묶는다. 삽입은 빨강으로, 삼촌 색에 따라 리컬러링 vs 회전.
3. **TMap은 std::map보다 std::unordered_map에 가깝다.** 둘 다 해시 계열이고, TMap은 거기에 UPROPERTY 직렬화·복제·GC 추적이라는 엔진 통합을 더한 것이다. UObject 맵은 반드시 TMap + UPROPERTY.
4. **Replication = 서버 권위 단방향 복제.** 지속 상태는 Property Replication(3종 세트), 순간 이벤트는 RPC(Server/Client/NetMulticast). "이미 일어난 일을 나중 합류 클라에게도 보여줘야 하면 상태 복제"가 선택 기준이고, `OnRep_` 서버 미호출 함정이 디버깅 단골이다.
5. **경계 사각형은 min/max 단일 스캔이면 충분하다.** 161990은 모든 `#`의 최소/최대 행·열만 추적하면 O(N·M) 한 번에 풀린다. 좌표가 격자점이라 끝점에 +1 보정을 잊지 말 것.

> **핵심 요약** — std::map vs TMap은 "트리 vs 해시" 하나에서 정렬·복잡도·캐시·엔진 통합까지 연쇄로 갈라진다. TMap은 std::map보다 std::unordered_map에 가깝고, UObject를 담는 맵이 반드시 TMap + UPROPERTY여야 하는 이유는 리플렉션과 GC 추적이다.
{: .prompt-tip }

