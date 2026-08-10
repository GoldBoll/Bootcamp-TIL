---
title: "다인 합산 이동 서버 권위 설계와 복제 표준"
subtitle: "물리는 순수 함수로, 가구는 인터페이스 계약만"
date: 2026-06-23 22:30:00 +0900
categories: ["언리얼", "쿠펭"]
tags: ["til", "ue5", "cpp", "network", "replication", "multiplayer", "interface", "git", "트러블슈팅"]
render_with_liquid: false
description: "여러 명이 가구 하나를 드는 게임에서 이동을 클라이언트가 계산하면 화면마다 가구 위치가 달라진다. 코드 전에 복제 표준부터 정한 이유와, 에디터를 막던 BuildId 불일치."
image: /assets/img/thumbs/cards/2026-06-23-til-teamcarry-network-foundation.svg
---

여러 명이 가구 하나를 같이 드는 게임에서, 이동을 클라이언트가 계산하게 두면 각자의 화면에서 가구가 다른 곳에 있게 된다. 그래서 코드를 쓰기 전에 **복제 표준부터 정했다** — 무엇을 서버가 계산하고 무엇을 내려보낼 것인가. 이 글에서는 그 토대를 깐 과정을 이야기하려 한다. 구현은 다인 합산 이동을 서버 권위로 두는 설계, 물리 계산을 테스트 가능한 순수 함수로 떼어낸 구조, 가구가 구현할 계약만 남긴 인터페이스이고, 트러블슈팅은 에디터가 `Missing Modules: Fab`으로 막히던 **BuildId 불일치**다.

## 1. 내 파트 — 접착제·안전망

팀 5명 전원 프로그래머에 도메인이 갈려 있다(Player/Furniture/Level/Core/UI). 내 역할은 단일 기능이 아니라 **통합·빌드·게임필 + 네트워크/물리 조율**이다. 팀 규칙의 핵심:

> 네트워크·물리는 단일 소유자가 아니라 **각 도메인에 분산** — 복제 변수는 도메인 담당이 소유하고, 통합 담당이 표준·세션·교차검증으로 묶는다.

그래서 이번 작업의 방향은 "내가 가구 로직을 다 짠다"가 아니라 **"각 도메인이 자기 복제 변수를 채워 넣을 표준과 계약을 깐다"**가 됐다.

## 2. 네트워크 복제 표준을 먼저 세운 이유

멀티에서 가장 흔한 버그가 "호스트만 보이고 클라엔 안 보임"이다. 변수 추가할 때마다 규칙이 흔들리면 통합 단계에서 터진다. 그래서 코드보다 **표준**을 먼저 문서화했다.

- 서버 권위(클라는 입력만, 결과를 복제받음)
- 상태 변경은 **서버에서만** — 직전에 `HasAuthority()` 가드
- 지속 상태 = `UPROPERTY(Replicated)`, 1회성 연출 = `Multicast`, 클라 요청 = `Server` RPC(클라가 서버에 함수 실행을 요청하는 원격 호출) + **서버 재검증**
- 잡힘/파손 연출은 `OnRep_`(복제 값이 도착했을 때 클라에서 호출되는 함수)에서 처리해 모든 클라 일관

권위 가드를 매번 손으로 쓰지 않게 `UTCNetStatics::HasAuthority/IsLocallyControlledPawn`로 단일 창구를 만들었다.

## 3. 합산 물리는 순수 함수로 분리

가구 운반의 핵심은 "여러 명이 동시에 끌 때 어디로 가나"다. 이걸 액터에 박지 않고 **상태 없는 static 함수**로 뺐다.

```cpp
FVector UTCCarryStatics::CombineCarryVelocity(const TArray<FVector>& MoveInputs, int32 RequiredCarriers, float BaseSpeed)
{
    // 운반자 의도 벡터 합산 → 방향 정규화
    FVector Sum = FVector::ZeroVector;
    for (const FVector& In : MoveInputs) Sum += In;
    const FVector Dir = Sum.GetSafeNormal();
    if (Dir.IsNearlyZero()) return FVector::ZeroVector;   // 서로 반대로 당기면 정지

    const float Ratio = CarrierFulfillRatio(MoveInputs.Num(), RequiredCarriers); // 정원 미달이면 감속
    return Dir * BaseSpeed * Ratio;
}
```

순수 함수라 액터 없이 단위 테스트·튜닝이 되고, 가구가 자체 합산 로직을 또 짜는 중복을 막는다. "서로 반대로 당기면 합벡터≈0 → 정지"가 **협동을 강제**하는 게임 규칙으로 그대로 떨어진 게 마음에 들었다.

## 4. 가구는 계약만 구현 — 인터페이스로 결합도 낮추기

가구 복제 변수(`bIsGrabbed` 등)는 다른 도메인 소유라 내가 못 건드린다. 대신 **"이 함수들만 있으면 운반이 굴러간다"**는 계약을 인터페이스로 줬다.

```cpp
class ITCGrabbable
{
public:
    virtual bool CanAddCarrier(ATCPlayerCharacter* C) const = 0;  // 정원·중복 검증
    virtual void AddCarrier(ATCPlayerCharacter* C) = 0;
    virtual void RemoveCarrier(ATCPlayerCharacter* C) = 0;
    virtual void ApplyCarryVelocity(const FVector& V, float Dt) = 0;
    virtual int32 GetRequiredCarriers() const = 0;
};
```

기존 상호작용 인터페이스(포커스·입력)와 **역할을 나눴다** — 이쪽은 운반 상태·물리 전담. 덕분에 가구 도메인과 네트워크 도메인이 한 파일을 동시에 안 건드린다(팀 규칙: 같은 파일 동시수정 금지).

세션도 OnlineSubsystem(Steam) 없이 **리슨 서버 + 직접 IP**로 최소 구현했다. `GetWorld()->ServerTravel("맵?listen")` 한 줄이면 호스트가 서버 겸 플레이어가 된다 — PIE 2~4인 테스트엔 이걸로 충분하고, Steam은 나중에 이 클래스에 확장하면 된다.

## 트러블슈팅 — 에디터가 Missing Modules로 막힌다

빌드 후 에디터를 여니 `Missing Modules: Fab — built with a different engine version`로 막혔다. 처음엔 내가 추가한 코드 탓인 줄 알았는데, 추적해보니 전혀 아니었다.

```text
엔진 5.8 본체 Changelist : 53629095
내 게임 모듈             : 53629095   ✅ 일치 (내 코드 정상 컴파일됨)
Fab 엔진 플러그인        : 55116800   ❌ 불일치
```

`.uproject`엔 Fab 참조가 없었다 — Fab은 **엔진 기본 플러그인**이고, 이놈이 **자기 자신을 최신 버전(55116800)으로 자동 업데이트**해서 엔진 본체(53629095)와 어긋난 것. UE의 컴파일된 모듈은 `BuildId`(엔진 Changelist)로 호환성을 검사하는데, 이 값이 다르면 "다른 엔진 버전" 취급이라 로드를 거부한다.

- 진단: `Binaries/Win64/UnrealEditor.modules`의 `BuildId` vs 엔진 `Build.version`의 `Changelist` vs 플러그인의 `.modules` BuildId를 셋 다 비교
- 해결: Epic Games Launcher에서 **엔진 검증(Verify)** → Fab만 53629095로 복원
- 교훈: "Missing Modules"가 떠도 **내 모듈 BuildId가 엔진과 같으면 내 코드 문제가 아니다.** 엔진 플러그인일 수 있다.

## 6. 회의 결정사항과 내 설계의 접점

저녁 회의에서 나온 결정이 이 설계와 정확히 맞물렸다.

**확정**
- 스테이지 선택: 이사센터 로비 게시판에서 선택 + 직접 트럭 운전(리썰 컴퍼니 풍)
- 시점: 인게임 **3인칭**(벽·문 보이게), 로비 **1인칭**, **시점 변환 키** 도입
- 가구 이동: **2인이 들고 양쪽 WASD 입력이 모두 들어올 때 방향벡터 합산**
- Git: 본인 브랜치 커밋 → **빌드 확인** → develop 병합

**내 설계와의 접점**
- 회의에서 "이동 중 속도(velocity) 동기화가 안 되고 순간이동 문제가 난다"고 했는데, 내가 합산을 **물리 velocity가 아니라 서버 `AddActorWorldOffset`(단순 이동)**으로 잡은 이유가 바로 이거다. 물리 시뮬은 동기화가 까다로워 캐주얼 게임엔 과하다.
- "2인 입력이 모두 들어와야 이동"은 내 `RequiredCarriers`(정원) + `CombineCarryVelocity`(양쪽 입력 합산) 구조와 그대로 대응된다.

## 정리 — 토대 설계에서 남은 것

1. **표준을 코드보다 먼저.** 멀티는 복제 규칙이 흔들리면 통합에서 터진다. 권위 모델·OnRep 규칙을 문서로 박아두고 시작했다.
2. **결합도는 인터페이스로 끊는다.** 남의 도메인 변수를 안 건드리고 "계약"만 주면, 같은 파일 동시수정 충돌 없이 시스템이 굴러간다.
3. **합산 로직은 순수 함수로.** 상태 없이 빼면 테스트·튜닝이 쉽고 중복 구현을 막는다. "반대로 당기면 정지"가 협동 규칙으로 자연스럽게 떨어졌다.
4. **`Missing Modules`는 BuildId부터 비교.** 내 모듈이 엔진 Changelist와 같으면 내 코드 탓이 아니다. 엔진 플러그인(Fab) 자동업데이트가 범인일 수 있고, 해법은 엔진 검증.
5. **설계가 회의 결정과 맞으면 자신감이 붙는다.** 물리 대신 단순 이동을 택한 근거가 회의의 "velocity 동기화 안 됨" 이슈로 검증됐다.

> **핵심 요약** — 멀티플레이 팀플은 코드보다 복제 표준과 계약 인터페이스를 먼저 깔아야 통합 단계에서 안 터진다. 그리고 `Missing Modules` 에러는 내 모듈과 엔진의 BuildId부터 비교하면 내 코드 탓인지 엔진 플러그인 탓인지 바로 가려진다.
{: .prompt-tip }

