---
title: "[TIL] 2026-07-23 — 공식 Blender MCP 구축, 에러 없이 실패하는 함정 2건과 펭귄 텍스처 FBX 파이프라인"
date: 2026-07-23 09:30:00 +0900
categories: ["언리얼", "팀프로젝트"]
tags: ["til", "ue5", "mcp", "blender", "python", "asset-import", "skeletal-mesh", "texture", "debugging"]
render_with_liquid: false
description: 공식 Blender MCP(blender.org/lab)를 구축하며 만난 에러 없는 실패 2건 — online_access 게이트와 CLI 활성화 휘발 — 을 상태덤프 스크립트로 규명했다. 구축 후 에이전트가 MCP로 펭귄을 임포트·검증하고, 텍스처 내장 FBX를 3중 검증으로 확인한 파이프라인 기록.
pin: true
image: /assets/img/til/2026-07-23/blender-penguin-render.png
---

부트캠프 8조 팀 프로젝트(UE5 협동 게임, 저장소 TeamCarry)의 플레이어 캐릭터인 펭귄 — 그 DCC 파이프라인의 Blender 구간을 만든 날이다. 이 펭귄은 외부 툴과 UE를 오가는 팀 공용 에셋이라, 어느 툴에서 열어도 상태를 확인·정리할 수 있는 경로가 프로젝트에 필요했다. 펭귄 모델 자체는 전날(7/22) Tripo로 생성해 AccuRIG로 리깅한 것이고(과정은 [7/22 TIL](/posts/til-penguin-accurig-rerig/)에 정리), 이날은 UE에서 뽑은 `SK_Penguin_Packed.fbx`를 Blender에서 확인·정리하는 흐름의 기반으로 **공식 Blender MCP**(blender.org/lab, 커뮤니티 ahujasid판 아님)를 작업 머신에 구축했다. 설치 과정에서 **에러 메시지 한 줄 없이 조용히 실패하는 함정을 2건** 만나 각각 원인을 규명했고, 구축이 끝난 뒤에는 에이전트가 MCP 도구만으로 펭귄 임포트→텍스처 확인→렌더 검증까지 원격으로 수행했다.

![MCP로 뽑은 펭귄 확인 렌더](/assets/img/til/2026-07-23/blender-penguin-render.png)
_구축한 MCP 파이프라인으로 뽑은 펭귄 확인 렌더(`render_thumbnail_to_path`) — 네이비 머리·흰 배·주황 부리·멜빵바지 텍스처가 살아 있다_

## 공식 Blender MCP 구축 — 에러 없이 실패하는 함정 2건

구조부터. 공식 Blender MCP는 세 조각이 연결된 형태다.

```
MCP 클라이언트(Claude) ⇐ stdio ⇒ blender-mcp 서버(uv) ⇐ TCP 9876 ⇒ Blender 애드온
```

서버는 `uv`로 실행되는 stdio MCP 서버이고, Blender 쪽은 **Blender 5.1 확장**(`bl_ext.user_default.mcp`)으로 설치되는 애드온이 TCP 9876으로 다리를 놓는다. 애드온의 "자동시작"을 켜 두면 Blender를 열 때마다 서버가 같이 뜬다 — 가 정상 동작인데, 여기서 함정 2건을 밟았다.

### 함정 1 — 온라인 접근 허용이 꺼져 있으면 자동시작이 조용히 실패한다

**증상**: 애드온 설치·자동시작 ON까지 끝냈는데 Blender를 열어도 포트 9876이 리스닝하지 않는다. 콘솔에 에러도, 경고도 없다.

**구조 분석**: 에러가 없으니 로그로는 추적이 안 된다. 그래서 Blender 안에서 돌아가는 **상태덤프 스크립트**를 만들어 애드온이 보는 세계를 직접 찍었다 — `bpy.app.timers`로 기동 직후 시점의 온라인 접근 상태·애드온 활성 여부·서버 기동 여부를 덤프하게 했다. 결과, `bpy.app.online_access`가 `False`. 시스템 설정의 **"온라인 접근 허용"이 꺼져 있으면 애드온 자동시작이 아무 말 없이 그냥 돌아가지 않는** 구조였다. 네트워크 기능(TCP 서버)을 여는 애드온이라 온라인 접근 게이트에 걸리는 것 자체는 타당한데, 문제는 실패가 **완전히 무음**이라는 점이다.

**해결과 근거**: 시스템 설정에서 온라인 접근 허용을 ON. 대안은 매번 애드온 패널에서 수동으로 서버를 켜는 것인데, "Blender만 열면 에이전트가 붙는" 자동화가 목적이라 수동 기동은 트레이드오프가 맞지 않았다.

### 함정 2 — CLI에서 켠 활성화는 GUI가 로드하는 userpref에 저장되지 않는다

**증상**: 설치를 스크립트로 재현 가능하게 하려고 CLI에서 `blender --command extension install-file --enable`로 설치·활성화했다. CLI 상으로는 성공. 그런데 GUI로 Blender를 열면 애드온이 **비활성** 상태다.

**구조 분석**: `--enable`은 그 CLI 세션 안에서만 애드온을 켠다. 활성화 상태가 **GUI가 기동할 때 로드하는 userpref에 저장되지 않으니**, 세션이 끝나는 순간 활성화도 증발한다. 설치(파일 복사)는 영구적인데 활성화(환경설정)는 휘발성인 — 두 단계의 저장 위치가 다른 구조다.

**해결과 근거**: 별도의 백그라운드 Blender 실행에서 `bpy.ops.preferences.addon_enable()` + `bpy.ops.wm.save_userpref()`를 돌려 **활성화를 userpref에 명시적으로 저장**했다. 대안은 GUI에서 체크박스를 손으로 켜고 환경설정을 저장하는 것 — 1회성으로는 되지만 스크립트 재현성이 없어서 택하지 않았다.

### 검증

- 포트 9876 리스닝 확인
- 함정 1에서 만든 디버그 덤프 재실행: `{'online_access': True, 'addon_enabled': True, 'server_running': True}`

설치 문제 2건 모두 "실패했다는 사실 자체가 보이지 않는" 유형이라, **상태를 직접 찍는 스크립트를 만드는 것**이 로그 뒤지기보다 빨랐다. 같은 스크립트가 해결 후에는 검증 도구로 재활용됐다.

## 에이전트가 MCP로 펭귄 임포트 — 텍스처 확인까지 원격 수행

구축이 끝났으니 바로 실전. 이번엔 사람이 Blender를 만지지 않고, **워커 에이전트가 MCP 도구만으로** 펭귄 임포트와 확인을 원격 수행했다.

- 소스: UE에서 익스포트한 `SK_Penguin_Packed.fbx` (2,220,316B, 텍스처 패킹)
- 임포트 결과 씬 구조: `SK_Penguin`(EMPTY) > `root`(ARMATURE, **본 77개** — `pelvis`/`ik_foot_root`/`ik_hand_root`가 있는 UE 스타일 IK 스켈레톤) > 메시(버텍스 3,210)

![Blender 작업 화면 — MCP로 임포트한 SK_Penguin](/assets/img/til/2026-07-23/blender-penguin-workspace.png)
_MCP로 임포트한 펭귄 — 아웃라이너에 root(ARMATURE) 하위 SK_Penguin 메시, Material Preview로 텍스처 확인_

텍스처는 손댈 게 없었다. 머티리얼 `MIC_Unlit_Penguin`에 FBX에 패킹돼 있던 `T_Penguin_D_1k.png`(1024²)가 **이미 Principled BSDF의 Base Color에 연결**된 채로 들어왔다. 수동 연결 없이 Material Preview 전환 + 스크린샷으로 텍스처가 그대로 나오는지 확인했고, 확인 렌더(`render_thumbnail_to_path`)까지 뽑았다 — 글 첫머리의 펭귄 렌더가 그 결과다.

한 가지 결정: 8K 원본 `T_Penguin_D.PNG`(105MB)도 있었지만, 뷰포트 확인·리깅 파이프라인 용도로는 과해서 1k를 썼다. 작업 상태는 `SK_Penguin_setup.blend`로 저장.

## 텍스처 내장 FBX 재익스포트 — 3중 검증

이 펭귄은 외부 툴과 UE를 오가는 에셋이라, FBX 하나만 들고 다녀도 어느 툴에서든 생김새가 보이도록 **텍스처를 파일 안에 내장**해 재익스포트했다.

```python
bpy.ops.export_scene.fbx(
    filepath=out_path,
    use_selection=True,
    embed_textures=True,   # 텍스처를 FBX 안에 패킹
    path_mode='COPY',      # embed_textures는 COPY 모드에서만 동작
    add_leaf_bones=False,  # UE 리임포트 시 잉여 리프본(_end) 방지
)
```

결과물 `SK_Penguin_Textured.fbx`(2,220,988B)에 텍스처가 **정말** 들어갔는지를 3중으로 검증했다. "옵션을 켰으니 됐겠지"는 이 파이프라인에서 제일 위험한 가정이다 — `embed_textures`는 `path_mode='COPY'`가 아니면 조용히 무시되기 때문에, 여기서도 무음 실패가 가능하다.

1. **크기 델타**: 텍스처 없이 뽑은 본체가 312,384B, 1k 텍스처가 1.84MB — 합이 최종 크기와 맞아떨어진다
2. **바이너리 스캔**: FBX 바이너리에서 PNG 시그니처를 직접 스캔해 텍스처 블록 존재 확인
3. **익스포트 로그**: 텍스처 임베드가 수행됐다는 로그 확인

`add_leaf_bones=False`는 나중을 위한 보험이다. 기본값(True)으로 두면 본 끝마다 `_end` 리프본이 붙어서, 리깅을 마치고 UE로 되가져올 때 스켈레톤에 잉여 본이 생긴다.

## 팀 발표자료 준비 — COUPENG 브랜드 템플릿

파이프라인 작업과 별개로, 팀 발표 PPT `8조 발표 ppt.pptx`(26슬라이드, 7/21 v0.2.0 빌드 기준, 739MB — 시연 영상 3본 포함)와 브로셔를 준비했다. **내 기여는 PPT 템플릿 제작·발표자료 준비·브로셔 작성**이고, 각 파트 슬라이드의 내용은 팀원들의 작업이다.

템플릿은 **COUPENG** — 쿠팡 패러디 브랜드 아이덴티티다. 크림 배경, 파랑/노랑 로고 타이포, 바코드·택배 모티프, 펭귄 마스코트로 "이사(택배) 게임"의 톤을 잡았다.

![COUPENG 템플릿 표지](/assets/img/til/2026-07-23/ppt-cover-coupeng.png)
_표지 — COUPENG 로고 타이포(파랑/노랑), "이삿짐을 안전하게 이삿짐 트럭에 옮겨라!", 펭귄 마스코트, 하단 바코드·팀 정보(TEAM 8조 캐리 / 2026.07.21 / v.0.2.0)_

![목차 레이아웃](/assets/img/til/2026-07-23/ppt-toc-template.png)
_목차 장 — 크림 배경 + 카드형 리스트 + 펭귄 일러스트로 템플릿 규격 통일_

발표 구성(슬라이드 제목 실측 순서): 프로젝트 소개 → 팀 구성 → 게임 시연 → UI → 멀티플레이(방 코드) → 레벨·스테이지 → 포스트 프로세싱(수식으로 그린 만화 하늘) → 가구 오브젝트·데이터 테이블 → 협동 운반 → 가구 파괴 → 상태 변화 → 세션 유지 → 실시간 점수 → 트러블슈팅 → 팀원 후기 → Q&A.

![트러블슈팅 장](/assets/img/til/2026-07-23/ppt-troubleshooting.png)
_트러블슈팅 장 — 러버밴딩(고무줄 튕김)을 "보이지 않는 목줄"(리쉬)로 잡은 사례를 Before/After로 구성 (사례 자체는 [7/15 TIL](/posts/til-carry-leash-movement/) 참조)_

브로셔는 노션 페이지 "8조 프로젝트(CouPeng) 브로셔"로 작성했다. 구성은 프로젝트 소개(이미지) → 게임 소개(핵심 메커니즘 3가지 — 협력 물리 / 환경 퍼즐·파괴 / 스테이지 선택) → 게임 개요 표(캐주얼·코옵, Steam, 2026.06.01~07.21 약 8주, 팀 6명, UE 5.8.0, C++) → 핵심 기능·기술·기술적 의사결정·트러블슈팅 DB → 팀 구성 표. 팀 구성 표 기준 나는 **팀장, Network/게임플레이 담당**이다.

![브로셔 소개 이미지](/assets/img/til/2026-07-23/brochure-cover.png)
_노션 브로셔의 프로젝트 소개 이미지 — CouPeng 로고와 이삿짐을 트럭에 옮기는 펭귄들_

## UE 애니메이션 적용 확인

리깅 파이프라인의 최종 목적지 확인. IK 리타게터(cc_base_* → IK_Penguin)·ABP_Penguin 구조 상세는 [7/22 TIL](/posts/til-penguin-accurig-rerig/)에 정리했으므로, 여기서는 **적용이 실제로 돌아가는지**만 에디터에서 확인했다.

![Walking 애니메이션 재생](/assets/img/til/2026-07-23/ue-penguin-anim-playing.png)
_Walking AnimSequence 에디터 — 펭귄 프리뷰에서 재생 중(플레이헤드 진행, 트랙 78개). Triangles 4,898 / Vertices 3,210_

![BS_BaseCharacter 프리뷰](/assets/img/til/2026-07-23/ue-penguin-blendspace.png)
_BS_BaseCharacter 블렌드 스페이스 에디터 — 펭귄 프리뷰 + 블렌드 샘플 3개(Idle/Walk/Slow_Run)_

Walking 시퀀스가 펭귄 스켈레톤에서 정상 재생되고, BS_BaseCharacter 블렌드 스페이스도 펭귄 프리뷰로 동작한다. 그리고 **메인 플레이어 `BP_PlayerCharacter`가 mesh=SK_Penguin, anim_class=ABP_Penguin_C로 사용 중** — 이 파이프라인의 결과물이 실제 플레이어 캐릭터에 물려 있다.

> **오늘 배운 것**
> - 에러 없이 실패하는 시스템은 **상태덤프 스크립트**로 잡는다 — 애드온이 보는 값(`online_access`)을 직접 찍는 쪽이 로그 추적보다 빨랐고, 같은 스크립트가 해결 후 검증 도구가 됐다
> - CLI의 상태 변경은 **어디에 저장되는지**까지 확인 — `--enable`은 세션 휘발, `addon_enable` + `save_userpref`로 영속화해야 재현 가능한 설치가 된다
> - 산출물 검증은 옵션이 아니라 **결과물**로 — `embed_textures`는 크기 델타·PNG 시그니처·로그 3중으로 확인했다
{: .prompt-tip }

> **면접에서 이렇게 말한다**
> - 예상 질문: "자동화 도구가 에러 없이 동작만 안 할 때 어떻게 디버깅하나요?" → Blender MCP 자동시작 무음 실패 사례로 답변 — 상태덤프 스크립트로 게이트 변수(`bpy.app.online_access`) 규명
> - 예상 질문: "DCC↔엔진 왕복 파이프라인에서 산출물을 어떻게 검증하나요?" → 텍스처 내장 FBX 3중 검증(크기 델타·바이너리 시그니처·로그) + `add_leaf_bones=False`
> - 키워드: MCP, stdio/TCP 브리지, bpy.app.online_access, save_userpref, embed_textures, path_mode COPY
{: .prompt-info }
