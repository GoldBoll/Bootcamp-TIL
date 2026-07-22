---
title: "이 블로그 읽는 법 — UE5 C++ 학습 기록 가이드"
date: 2026-07-08 11:00:00 +0900
categories: ["회고"]
tags: ["til"]
pin: true
render_with_liquid: false
description: "처음 오셨다면 여기부터 — 프로젝트 하이라이트, 카테고리 지도, 추천 글 모음"
image: /assets/img/thumbs/til.svg
---

Unreal Engine 5 C++ 게임 개발 부트캠프의 **매일 학습 기록**입니다. 하루 단위 TIL, 매일 아침 알고리즘 코드카타, CS 모의면접 준비를 각각 시리즈로 쌓고 있습니다. 짧게 보실 분들을 위한 지도입니다.

## 프로젝트 하이라이트

| 프로젝트 | 내용 | 코드 |
|---|---|---|
| **TeamCarry** | 4주 팀 프로젝트(팀장) — 이사(가구 운반) 협동 멀티플레이. Steam 세션·리플리케이션·패키징 | [GitHub](https://github.com/GoldBoll/TeamCarry) |
| **NumberBaseball** | 멀티플레이 숫자야구 — 서버 권위·PlayerState 복제·RPC 흐름 | [GitHub](https://github.com/GoldBoll/NBC_JangSik_Assignment9) |
| **Module & Plugin** | 언리얼 모듈/플러그인 구조 분해 과제 | [GitHub](https://github.com/GoldBoll/NBC_JangSik_Assignment10) |

프로젝트 과정은 TIL로 남겼습니다 — 대표 글:

- [스팀 멀티플레이 트러블슈팅](/posts/til-teamcarry-steam-multiplayer-troubleshooting/) — 패키징 빌드에서만 터지는 세션 버그 추적
- [멀티플레이 Replication 디버깅](/posts/til-unreal-replication-debugging/) — 이름 권위·PlayerState 복제 타이밍·게임 리셋
- [패키징과 Steam 세션](/posts/til-teamcarry-packaging-steam-session/) — 데디케이트 없는 리슨 서버 구성

## 카테고리 지도

- **언리얼 (51편)** — UE5 C++ 과제·강의 정리와 팀프로젝트 개발 기록. 하위 `팀프로젝트`(29편)가 TeamCarry 협동 멀티 트러블슈팅의 중심입니다. 추천: [절차식 툰 스카이 머티리얼](/posts/til-toon-sky-material/), [협동 운반 러버밴딩 해결](/posts/til-carry-leash-movement/)
- **알고리즘 (103편)** — 매일 코드카타. 프로그래머스·백준·LeetCode를 강사 코드 스타일(C++)로 풀고 "접근 → 코드 → 정리" 형식으로 남깁니다. 카드의 **"핵심 접근 —"** 한 줄로 어떤 기법인지 바로 확인할 수 있습니다. 추천: [BFS·시뮬레이션 시험 회고](/posts/til-bfs-simulation-exam/)
- **CS (37편)** — 모의면접 질문 단위 정리. vtable·RTTI·스마트 포인터 같은 C++ 심화부터 프로세스/스레드·동기화·가상 메모리(OS), 자료구조까지. 각 글은 "30초 답변 → 꼬리질문 → 언리얼 연결" 구조입니다. 추천: [Race Condition](/posts/cs-23-race-condition/)
- **회고 (6편)** — 기획·포트폴리오·블로그 운영 기록.

## 이 블로그의 규칙

- 모든 알고리즘 코드는 **실제 컴파일·실행 검증** 후 올립니다 (MSVC `/std:c++17`)
- CS 정리는 모의면접에서 **실제로 받은 질문·막힌 부분**을 다음 날 보강하는 방식으로 갱신합니다
- 커밋 이력이 곧 학습 이력입니다 — [GitHub 프로필](https://github.com/GoldBoll)
