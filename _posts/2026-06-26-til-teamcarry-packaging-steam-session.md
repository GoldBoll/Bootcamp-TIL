---
title: "UAT 패키징 실패와 Steam 세션 디버깅"
subtitle: "에디터에서 되던 프로젝트가 쿡 단계에서 멈춘 이유"
date: 2026-06-26 22:00:00 +0900
categories: ["언리얼", "팀프로젝트"]
tags: ["til", "ue5", "multiplayer", "dedicated-server", "git", "debugging", "트러블슈팅"]
render_with_liquid: false
description: "패키징 단계에서 처음으로 빌드가 멈췄고, 고쳐서 실행 파일을 뽑아도 Steam 세션이 붙지 않았다. 에디터에서 실행 파일까지 가는 길을 뚫고, 그 사이 어긋난 팀 브랜치를 되돌린 기록."
image: /assets/img/thumbs/unreal.svg
---

에디터에서 잘 돌아가던 프로젝트가 패키징 단계에서 처음으로 멈춰 섰다. 쿡 단계에서 빌드가 실패하고, 고쳐서 실행 파일을 뽑아도 이번엔 Steam 세션이 붙지 않았다. 이 글에서는 **에디터에서 실행 파일까지 가는 길을 뚫은 과정**을 이야기하려 한다 — 패키징 오류 원인과 수정, Steam 멀티플레이어 세션 흐름 검증, 그리고 그 사이에 어긋난 팀 브랜치를 되돌린 롤백까지다.

## 트러블슈팅 1 — 쿡 단계에서 빌드가 실패한다

### 문제: exit code 25

UAT(UnrealAutomationTool)의 쿡(Cook, 에셋을 대상 플랫폼용 포맷으로 변환하는 단계)에서 **exit code 25**로 빌드가 실패했다. UAT는 쿠킹 로그에서 `LogLevel: Error`가 하나라도 보이면 빌드 실패로 판정한다.

```cpp
// S_MainMenu.cpp — 수정 전 (빌드 실패 원인)
UE_LOG(LogTemp, Error, TEXT("..."));   // 4군데

// 수정 후
UE_LOG(LogTemp, Log, TEXT("..."));    // Error → Log
```

런타임 의미상 에러가 아닌 상황인데 `Error` 레벨을 관용적으로 쓴 게 UAT 판정을 트리거했다. 실제 예외 상황이 아니라면 `Warning` 이하를 쓰는 습관이 필요하다.

### DefaultGame.ini 쿠킹 대상 교체

쿠킹 대상 맵이 `NetTest`로 지정돼 있었는데, 이 맵에서 참조하는 BP의 부모 클래스가 누락된 상태였다. 대상을 `Prototype` 맵으로 교체해서 해결했다.

```ini
; DefaultGame.ini
[/Script/UnrealEd.ProjectPackagingSettings]
MapsToCook=(FilePath="/Game/Maps/Prototype")
```

---

## 트러블슈팅 2 — Steam 세션이 붙지 않는다

### `Steam_Find`가 0개 반환하는 문제

세션을 찾지 못하는 원인은 **순서 문제**였다. 호스트가 세션을 완전히 생성하기 전에 클라이언트가 검색을 날려 0개를 받은 것.

올바른 워크플로우:

```
1. 호스트:     Steam_Host 블루프린트 실행
2. 호스트:     CreateSession 완료 콜백(OnSuccess) 수신 확인
3. 클라이언트: 그 다음에 Steam_Find 실행
4. 클라이언트: 검색 결과에서 Steam_Join 실행
```

`CreateSession`이 끝나기 전에 `FindSessions`를 하면 당연히 빈 결과다. **비동기 완료 이벤트를 기다리는 순서**가 핵심이었다.

### 환경 설정

- Steam OSS(OnlineSubsystem Steam, 언리얼 온라인 기능의 Steam 구현) AppID: **480(Spacewar)** — 개발용 공개 AppID, 친구 관계 없이 공개 로비 검색 가능
- `DefaultEngine.ini`에 P2P 정리 타임아웃 추가 (세션 종료 후 소켓 정리 지연 경고 제거)

```ini
[SocketSubsystemSteamIP]
P2PCleanupTimeout=120
```

`Steam_Host → Steam_Find → Steam_Join` 순서로 실제 멀티 접속 성공 확인.

---

## 트러블슈팅 3 — 팀 브랜치를 되돌리기

팀원이 PR 없이 `develop`에 직접 커밋 2개를 머지한 것을 발견했다. 팀 협업 규칙 위반이라 롤백이 필요했다.

```bash
git reset --hard <정상커밋>          # develop을 정상 커밋으로 되돌림
git push --force origin develop   # 원격에도 강제 반영
```

**force push 이후 팀원 전파 필수:**

```bash
# 팀원 전원이 실행해야 함
git fetch origin
git reset --hard origin/develop
```

force push는 히스토리를 재작성하므로 팀원의 로컬 브랜치가 원격과 달라진다. 팀 채널에 즉시 공지가 필수.

---

## 4. PR 생성 및 base 브랜치 수정

`feat/furniture-prototype` → `develop` PR을 생성했는데 `--base` 옵션을 빠뜨려 `main`에 걸렸다.

```bash
# 잘못 생성된 상태 (base: main)
gh pr create --title "feat: furniture prototype"

# base 브랜치 수정
gh pr edit 13 --base develop
```

`gh pr create` 시 저장소의 기본 브랜치(main)로 base가 설정된다. `develop` 운영 저장소에서는 **항상 `--base develop`을 명시**해야 한다.

---

## 결과 — 패키징 빌드 성공

UAT BuildCookRun으로 Development 구성 패키징 완료.

```
출력: Packaged/Windows/TeamCarry.exe
```

로그 레벨 수정 + 쿠킹 대상 교체 두 가지로 exit code 25가 사라졌다.

---

## 정리 — 패키징에서 남은 것

1. **UAT는 `UE_LOG Error`를 빌드 실패로 판정한다.** 쿠킹 로그에 Error 레벨이 보이면 exit code 25로 종료. 런타임 에러가 아닌 일반 출력은 `Log` / `Warning`을 쓰자.
2. **Steam 세션은 순서가 전부다.** `CreateSession` OnSuccess 콜백 이후에 `FindSessions`를 해야 한다. 완료를 기다리지 않으면 항상 0개.
3. **force push 후엔 팀 공지가 세트.** `git reset --hard origin/<branch>`를 팀원이 직접 실행해야 로컬이 맞춰진다. 자동으로 되지 않는다.
4. **`gh pr create`의 default base는 저장소 기본 브랜치.** `develop` 운영 시 `--base develop` 명시가 필수. PR 생성 후 `gh pr edit <num> --base <branch>`로 수정 가능.
5. **쿠킹 대상 맵의 BP 의존성도 빌드 결과에 영향.** 맵을 바꿀 때 그 맵의 BP 부모 클래스가 모두 빌드에 포함돼 있는지 확인해야 한다.

> **핵심 요약** — UAT는 쿠킹 로그에 Error 레벨 로그가 하나라도 있으면 exit code 25로 빌드를 실패시키므로, 실제 예외가 아닌 출력에 `UE_LOG Error`를 쓰면 안 된다. Steam 세션은 CreateSession 완료 콜백을 받은 뒤에 FindSessions를 해야 검색이 된다는 비동기 순서도 직접 확인했다.
{: .prompt-tip }

