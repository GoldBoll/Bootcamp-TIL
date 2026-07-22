---
# the default layout is 'page'
icon: fas fa-info-circle
order: 1
---

## 안녕하세요, GoldBoll입니다

Unreal Engine 5 C++ 게임 개발을 공부하는 부트캠프 수강생입니다.  
매일 배운 것을 기록하고, 면접 준비와 알고리즘 풀이를 병행하고 있습니다.

---

## 핵심 작업 한눈에

클릭 없이 이 페이지 스크롤만으로 확인하실 수 있게, 대표 작업을 "문제 → 해결 → 결과" 한 줄씩으로 추렸습니다. 각 줄 끝 링크가 상세 기록입니다.

### 언리얼 팀프로젝트 — TeamCarry (4인 협동 이사 게임 · 팀장)

Steam 리슨서버 멀티플레이. 두 명이 가구를 맞들고 옮기는 협동 운반이 핵심 시스템입니다. [GitHub](https://github.com/GoldBoll/TeamCarry)

- **협동 운반 러버밴딩** — 운반 중 캐릭터가 되끌리는 원인이 "서버가 CMC 예측 위에 위치를 한 번 더 보정하는 구조"에 있음을 찾음 → 견인 주입을 걷어내고 입력 단계에서 이동을 제한하는 리쉬(leash)로 전환 → 콘솔 치트로 줄다리기를 재현해 밴딩 소멸 검증. [기록](/posts/til-carry-leash-movement/)
- **방코드 스팀 멀티 완주** — 방 생성→검색→P2P 접속→게임 진입이 실기기에서 구간마다 끊김 → 추측 대신 로그 판독으로 문제→가설→수정 사이클을 7라운드 반복 → PC 2대 실기기로 전 구간 완주, PR #51·#54 develop 머지. [기록](/posts/til-teamcarry-steam-multiplayer-troubleshooting/)
- **라이트맵 베이크 실패 추적** — Build Lighting을 돌리면 벽이 그라데이션 없는 주황 덩어리가 됨 → 하나로 보였던 원인이 실제로는 셋임을 순서대로 확인 → 남는 한계까지 검증한 뒤 전 조명 Movable 전환으로 결론. [기록](/posts/til-lightmap-bake-failure/)
- **로비 맵 프리로드 충돌** — 로딩을 줄이려고 넣은 스테이지 맵 프리로드가 게임 진입 자체를 막음 → "호스트가 먼저 멈추는" 비대칭 증상에서 서버 전용 코드를 역추적, ServerTravel의 LoadMap이 같은 맵 패키지를 다시 여는 충돌임을 확인 → 프리로드 제거 + "맵이 아니라 맵이 쓰는 에셋 단위로 데워야 한다"는 기준 정리. [기록](/posts/til-lobby-map-preload-travel-conflict/)

![라이트맵 빌드 직후 — 벽 전체가 한 덩어리](/assets/img/posts/2026-07-20/bake_burned.png){: w="480" }
_라이트맵 추적의 출발점 — 벽이 통째로 타버린 첫 베이크_

![콘솔 치트로 줄다리기 재현](/assets/img/posts/2026-07-15/tugofwar_mid.png){: w="480" }
_러버밴딩 검증 — 키보드 하나로 2인 줄다리기를 재현하는 콘솔 치트_

### CS — 모의면접 준비 (C++ · 자료구조 · OS)

- **페이지 폴트 ↔ 게임 히치 연결** — OS 개념을 60fps 프레임 예산 16.6ms와 연결 → HDD major fault 한 번이면 프레임이 통째로 날아가고, 레벨 로드는 의도된 major fault 폭증이라는 해석 → "hot path에서 major fault 0회"라는 엔진 메모리 관리 목표로 정리. [기록](/posts/til-2026-05-18/)
- **std::map vs TMap** — "트리 vs 해시" 한 축에서 정렬·복잡도·캐시·엔진 통합까지 연쇄로 갈라 정리 → TMap은 std::map보다 std::unordered_map에 가깝고, UObject 맵이 TMap + UPROPERTY여야 하는 이유는 리플렉션·GC 추적이라는 답변 라인 완성. [기록](/posts/til-stdmap-tmap-replication/)
- **C++ 심화 시리즈** — vtable·가상 소멸자·스마트 포인터부터 프로세스/스레드·가상 메모리까지, 모의면접에서 실제로 받은 질문과 막힌 부분을 다음 날 보강하는 방식으로 "30초 답변 → 꼬리질문 → 언리얼 연결" 구조를 유지. [CS 카테고리 (37편)](/categories/cs/)

### 알고리즘 — 매일 코드카타

- **문제 풀이 82편** — 프로그래머스 45 · 백준 19 · LeetCode 18. 전부 MSVC `/std:c++17`로 컴파일·실행 검증 후 발행. [알고리즘 카테고리](/categories/알고리즘/)
- **DFS 패턴 4종** — 백준 2606·1325·11724·2644 네 문제를 하나의 템플릿 변형으로 묶어 그래프 탐색 패턴으로 정리. [기록](/posts/til-dfs-graph/)
- **슬라이딩 윈도우 고정 vs 가변** — LeetCode 643·3으로 두 유형의 판별 기준과 코드 골격 차이를 비교 정리. [기록](/posts/til-sliding-window/)
- **BFS·시뮬레이션 시험 복기** — 시험 3문제(보물섬·그림·NBA 농구)를 접근 선택 이유부터 다시 풀어 기록. [기록](/posts/til-bfs-simulation-exam/)

---

## 기록 카테고리

| 카테고리 | 내용 |
|---|---|
| **언리얼** | UE5 C++ — 과제·강의 정리. 하위 `팀프로젝트`는 TeamCarry 협동 멀티 개발 기록 |
| **알고리즘** | 매일 코드카타 — 프로그래머스·백준·LeetCode 풀이 + 패턴 정리 |
| **CS** | 모의면접 준비 — C++ 심화·자료구조·OS (Notion 연동) |
| **회고** | 기획·포트폴리오·블로그 운영 기록 |

---

## 연락처

- GitHub: [github.com/GoldBoll](https://github.com/GoldBoll)
- Email: goldball1012@gmail.com
