---
title: "포스트 프로세스 한 패스로 아웃라인과 포커스 링"
subtitle: "패스를 늘리지 않고 하이라이트를 얹는 법"
date: 2026-07-07 21:30:00 +0900
categories: ["언리얼", "쿠펭"]
tags: ["til", "ue5", "cpp", "material", "gamemode", "multiplayer", "debugging", "트러블슈팅"]
render_with_liquid: false
description: "'지금 뭘 잡을 수 있는지 안 보인다'는 피드백. 패스를 하나 더 얹는 대신 이미 있는 아웃라인 머티리얼 안에서 세피아 외곽선과 노란 링을 같이 그렸고, 화면 가장자리 점선 아티팩트도 잡았다."
image: /assets/img/posts/2026-07-07/highlight-ring.jpg
---

"지금 뭘 잡을 수 있는지 안 보인다"는 피드백을 받고 인터랙션 하이라이트를 만들었다. 쉬운 길은 포스트 프로세스 패스를 하나 더 얹는 것이지만, 패스는 그대로 프레임 비용이다. 그래서 **이미 있는 아웃라인 머티리얼 한 패스 안에서** 세피아 아웃라인과 노란 포커스 링을 같이 그리는 쪽으로 갔다. 이 글에서는 그 구현과, 따라온 트러블슈팅 두 건 — 화면 가장자리에 점선이 끼던 아티팩트와 Live Coding 크래시 — 을 이야기하려 한다.

## 기술 구현 — 패스 하나로 아웃라인과 링을 같이

튜터 피드백 중 "상호작용 가능한 가구에 포커스하면 하이라이트를 줘라"가 있었다. 가장 쉬운 길은 하이라이트 전용 포스트 프로세스 패스를 하나 더 붙이는 것이지만, 이미 화면엔 셀 셰이딩 밴딩 + 뎁스 아웃라인 PP가 돌고 있다. 패스를 늘리는 대신 **기존 아웃라인 머티리얼 하나에 링을 통합**하기로 했다.

### 아이디어: CustomStencil로 "이 픽셀은 포커스 대상"을 표시

포커스된 액터만 CustomDepthStencil 값을 1로 세팅하면, 포스트 프로세스에서 `SceneTexture: CustomStencil`(id 25)을 읽어 그 실루엣을 알 수 있다. 실루엣 **바깥 1픽셀**만 칠하면 딱 테두리 링이 된다.

핵심 HLSL (기존 뎁스 아웃라인 계산 뒤에 이어붙임):

```hlsl
float2 uvC = GetDefaultSceneTextureUV(Parameters, 25);
float  hC  = SceneTextureLookup(uvC, 25, false).r;   // 자기 픽셀 스텐실
// hR/hL/hU/hD = HighlightWidth 픽셀만큼 오프셋한 이웃 4방향 스텐실 샘플
float isT  = step(0.5, hC);                           // 자기 픽셀이 대상인가
float nbor = max(max(hR, hL), max(hU, hD));           // 이웃 중 대상이 있나
float ring = (1.0 - isT) * step(0.5, nbor);           // 나는 대상 아님 + 이웃은 대상 = 실루엣 '바깥' 1링
col = lerp(col, HighlightColor, ring * HighlightOpacity);
```

`(1.0 - isT) * step(0.5, nbor)`가 링의 정의다. **내 픽셀은 스텐실 대상이 아닌데(1-isT) 이웃 중 하나는 대상(nbor≥0.5)** → 나는 실루엣 딱 바깥 한 줄. 이러면 실루엣 내부는 안 칠하고 바깥 테두리만 얇게 감싼다. 오프셋 폭 `HighlightWidth`가 링 두께다.

오프셋 샘플링은 뎁스 아웃라인에서 쓴 그대로 `GetDefaultSceneTextureUV`로 UV를 얻고 텍셀 크기만큼 밀어 4방향을 뜬다. 뎁스 아웃라인과 완전히 같은 샘플링 인프라를 재사용했으니 실질 추가 비용은 스텐실 룩업 몇 번뿐이다.

### C++ 훅 체인 — 스캔부터 스텐실 토글까지

머티리얼이 스텐실을 읽으니, C++ 쪽은 "포커스된 액터의 스텐실을 1로 켜고 나머지는 끈다"만 하면 된다. 체인은 이렇다.

```
GrabComponent::ScanBestTarget   // 박스 트레이스 + 스코어링 (기존 코드)
  └→ ITCInteractable::Execute_OnFocus / OnUnfocus   // 인터페이스 디스패치
       └→ 각 액터: SetCustomDepthStencilValue(1)
                   SetRenderCustomDepth(true / false)
```

`ScanBestTarget`은 이미 있던 코드(플레이어 앞을 박스 트레이스해서 상호작용 후보를 점수화)라 손대지 않았다. 새로 한 건 **인터페이스 이벤트를 받는 쪽**의 구현이다.

| 파일 | 이전 상태 | 이번 작업 |
|---|---|---|
| `TCCarriableFurniture` | `OnFocus`/`OnUnfocus` 빈 스텁 | 스텐실 1 토글 구현 ← **실제 레벨 가구의 정체** |
| `FurnitureActor::SetHighlight` | 더미 함수 | 구현 |
| `InteractableDoor` / `TCBatItem` / `TCMapInteractable` | 커스텀뎁스만 토글 | 스텐실 값 1 추가로 셰이더 기준 통일 |

기존 액터들은 커스텀뎁스는 켜고 있었지만 스텐실 값을 안 넣고 있었다. 셰이더가 스텐실 1을 기준으로 링을 그리니, **모든 상호작용 액터의 스텐실 값을 1로 통일**하는 게 이번 작업의 절반이었다.

### 반전: 레벨 가구 22개는 전부 `TCCarriableFurniture`였다

여기가 이날의 함정이었다. 나는 레벨에 놓인 가구 22개가 전부 CatchCharacter 플러그인의 `FurnitureActor`(→ `BP_Furniture_Box`)일 거라 생각하고 `FurnitureActor::SetHighlight`부터 구현했다. 그런데 레벨 가구에는 링이 전혀 뜨지 않았다. 레벨의 박스 액터들을 하나씩 열어 실제 클래스를 확인해 보니, 박스들은 애초에 `FurnitureActor`가 아니라 전부 **`TCCarriableFurniture` 기반**이었다. BP 이름(`BP_Furniture_Box`)만 보고 부모 클래스를 단정한 게 함정. 정작 채워야 할 건 `FurnitureActor::SetHighlight`가 아니라 **`TCCarriableFurniture`의 빈 `OnFocus`/`OnUnfocus` 스텁**이었고, 이 스텁이 비어 있었기 때문에 아무리 셰이더와 스캔이 맞아도 링이 안 떴다. 빈 스텁을 채운 순간 링이 켜졌다.

교훈: **BP 이름만 보고 부모 클래스를 단정하지 마라.** 하이라이트가 안 뜨면 셰이더보다 먼저 액터의 실제 클래스 계층부터 확인해야 한다 — 이벤트를 받는 쪽이 빈 스텁이면 나머지가 다 맞아도 아무 일도 일어나지 않는다.

### 전제 조건과 검증

- **전제 조건**: `r.CustomDepth=3` (Enabled with Stencil). 스텐실을 안 쓰는 모드면 셰이더가 읽을 값 자체가 없다.
- **검증**: 먼저 디테일 패널에서 가구 메시의 Render CustomDepth와 스텐실 값(1)을 수동으로 토글해 셰이더가 링을 제대로 그리는지부터 격리 검증했다. 그다음 PIE에서 가구에 다가가 포커스가 잡히면 링 ON, 시선을 돌리면 OFF가 되는지로 C++ 훅 체인을 확인했다.
- **컴파일 루프**: Live Coding으로 에디터 재시작 없이 C++를 컴파일하고 MSVC 진단을 바로 확인하며 반복을 빠르게 돌렸다.

아래가 완성 결과다. 포커스된 박스만 노란 링, 나머지 상호작용 대상은 세피아 아웃라인만.

![인터랙션 하이라이트 링 — 포커스된 박스에 노란 링](/assets/img/posts/2026-07-07/highlight-ring.jpg)

## 트러블슈팅 1 — 화면 가장자리에 점선이 낀다

링을 켜니 새 증상이 나왔다. 스텐실 실루엣이 **화면 경계에 걸치면** 그 경계를 따라 노란 점선이 생겼다.

**원인**: 이웃 샘플 UV를 `saturate(uv ± texel)`로 클램프하고 있었다. 화면 가장자리에서는 `uv + texel`이 1을 넘어 saturate에 잘리면서 **이웃 샘플이 자기 픽셀 위치로 접혀 들어온다.** 그러면 `nbor`가 자기 스텐실 값을 보게 되고, 경계 라인을 따라 링 판정이 거짓으로 켜져 점선이 뜬다.

**수정 (1픽셀 경계 가드)**: 픽셀이 화면 어느 가장자리든 `HighlightWidth + 1`픽셀보다 가까우면 링을 죽인다.

```hlsl
float2 vUV     = GetViewportUV(Parameters);
float2 edgePix = min(vUV, 1.0 - vUV) * View.ViewSizeAndInvSize.xy;  // 4변 중 가장 가까운 경계까지 픽셀 거리
ring *= step(HighlightWidth + 1.0, min(edgePix.x, edgePix.y));      // 경계 밴드 안이면 0
```

`min(vUV, 1.0 - vUV)`는 각 축에서 "가까운 쪽 경계까지의 정규화 거리"이고, 뷰 크기를 곱해 픽셀 거리로 바꾼다. 오프셋 폭 + 1픽셀 여유보다 안쪽에 있을 때만 링을 살리니, 클램프가 접히는 밴드에서는 링이 아예 안 그려진다.

**검증**: 에디터 카메라 요(yaw)를 틀어 박스를 화면 왼쪽 경계에 반쯤 걸쳐놓고 뷰포트에서 확인 — 점선 없이 링이 프레임 밖으로 깔끔히 빠졌다.

## 트러블슈팅 2 — Live Coding 크래시

C++ 훅을 반복 컴파일하며 Live Coding 패치가 두 개(patch_0, patch_1) 쌓였다. 이 상태에서 레벨을 전환하니 에디터가 `Exception 0x80000003`으로 크래시했다.

로그에는 `Cannot find image section .voltbl`이 찍혔는데, 이건 MSVC/Live Coding의 **알려진 노이즈**로 직접 원인이 아니다(voltbl은 컨트롤 플로우 가드용 섹션이라 없어도 무방). 진짜 원인은 여러 패치가 쌓인 채로 하는 레벨 전환 자체의 불안정성.

재시작하자 **런처가 소스 파일이 DLL보다 최신임을 감지**해 콜드 리빌드를 돌렸고, 이번엔 훅 코드가 임시 패치가 아니라 **정식 DLL에 정상 포함**됐다. DLL과 소스 파일 타임스탬프를 비교해 확인:

```
Live coding: NoChanges   // 소스 = DLL 최신, 더 패치할 게 없음 → 콜드 빌드가 최종 반영됨
```

패치 상태가 정리되고 나니 이후로는 안정적이었다. 교훈: **Live Coding 패치가 쌓인 상태에서 레벨 전환은 위험**하다. 여러 번 컴파일했다면 한 번 콜드 빌드로 정리하는 게 최종 안정 상태다. 크래시가 오히려 강제 콜드 빌드를 유도해 전화위복이 된 셈.

같은 날 잡은 PostLogin 로비 킥 버그는 이 글의 주제와 달라 덜어냈다. 로비와 게임 맵 사이의 트래블 문제는 [로비에서 다음 맵을 미리 로드했더니](/posts/til-lobby-map-preload-travel-conflict/)에서 이어서 다룬다.

## 정리 — 이 구현에서 남은 것

1. **하이라이트는 패스를 늘리지 말고 스텐실로 기존 아웃라인에 얹는다.** `(1-isT) * step(0.5, nbor)`가 실루엣 바깥 1링의 정의다 — 내 픽셀은 대상 아님 + 이웃은 대상. 상호작용 액터의 스텐실 값을 1로 통일하는 게 절반의 일.
2. **BP 이름만 보고 부모 클래스를 단정하지 마라.** 레벨 가구 22개의 진짜 클래스는 `TCCarriableFurniture`였고, 채워야 할 곳은 그 빈 `OnFocus`/`OnUnfocus` 스텁이었다. 하이라이트가 안 뜨면 셰이더보다 액터의 실제 클래스 계층부터 확인하자.
3. **경계 클램프는 이웃 샘플을 자기 픽셀로 접는다.** 오프셋 샘플링 링·아웃라인은 뷰포트 UV 기반 1픽셀 경계 가드로 프레임 가장자리를 죽여야 점선이 안 생긴다.
4. **Live Coding 패치가 쌓인 상태에서 레벨 전환은 위험하다.** 여러 번 컴파일했다면 콜드 빌드로 정리하는 게 최종 안정 상태 — `.voltbl` 로그는 알려진 노이즈라 직접 원인으로 오독하지 말 것.
5. **하드 트래블은 `PostLogin`, 심리스 트래블은 `HandleSeamlessTravelPlayer`.** 로그인 훅 조건은 두 경로 차이를 고려해야 하고, 난입 차단 같은 게이트는 `Playing` 페이즈로 한정해야 한다(Logout의 기록 조건과 대칭).

> **핵심 요약** — 새 포스트 프로세스 패스를 추가하는 대신 CustomStencil을 읽어 기존 아웃라인 머티리얼 하나에 하이라이트 링을 얹었고, 하이라이트가 안 뜨는 원인은 셰이더가 아니라 실제 가구 클래스(`TCCarriableFurniture`)의 빈 `OnFocus` 스텁이었다. 오후의 로비 킥 버그는 하드 트래블만 `PostLogin`을 탄다는 구조를 이해하고 나니 `Playing` 페이즈 게이트 한 줄로 끝났다.
{: .prompt-tip }

