---
title: "Tripo 펭귄 텍스처 내장 FBX 추출"
subtitle: "Blender 확인과 3중 검증으로 파일 하나만 들고 다니기"
date: 2026-07-23 09:30:00 +0900
categories: ["언리얼", "팀프로젝트"]
tags: ["til", "ue5", "blender", "asset-import", "skeletal-mesh", "texture"]
render_with_liquid: false
description: "Tripo로 생성해 리깅한 펭귄을 FBX로 뽑아 Blender에서 스켈레톤과 텍스처를 확인하고, 텍스처를 파일에 내장해 재익스포트했다. '정말 들어갔는가'를 세 가지 방법으로 검증한 기록."
pin: true
image: /assets/img/til/2026-07-23/blender-penguin-render.png
---

부트캠프 8조 팀 프로젝트(UE5 협동 게임, 저장소 TeamCarry)의 플레이어 캐릭터인 펭귄의 FBX 파이프라인을 정리한 날이다. 펭귄 모델은 [Tripo로 생성해 AccuRIG로 리깅](/posts/til-penguin-accurig-rerig/)한 것이고, 여기서는 UE에서 뽑은 `SK_Penguin_Packed.fbx`를 Blender에서 확인·정리하고 **텍스처 내장 FBX로 재추출**하는 흐름을 만들었다. 이 펭귄은 외부 툴과 UE를 오가는 팀 공용 에셋이라, FBX 하나만 들고 다녀도 어느 툴에서든 생김새가 보이는 상태가 목표였다.

![펭귄 확인 렌더](/assets/img/til/2026-07-23/blender-penguin-render.png)
_Blender에서 뽑은 펭귄 확인 렌더 — 네이비 머리·흰 배·주황 부리·멜빵바지 텍스처가 살아 있다_

## 펭귄 FBX 확인 — Blender 임포트와 텍스처 검증

- 소스: UE에서 익스포트한 `SK_Penguin_Packed.fbx` (2,220,316B, 텍스처 패킹)
- 임포트 결과 씬 구조: `SK_Penguin`(EMPTY) > `root`(ARMATURE, **본 77개** — `pelvis`/`ik_foot_root`/`ik_hand_root`가 있는 UE 스타일 IK 스켈레톤) > 메시(버텍스 3,210)

![Blender 작업 화면 — 임포트한 SK_Penguin](/assets/img/til/2026-07-23/blender-penguin-workspace.png)
_임포트한 펭귄 — 아웃라이너에 root(ARMATURE) 하위 SK_Penguin 메시, Material Preview로 텍스처 확인_

텍스처는 손댈 게 없었다. 머티리얼 `MIC_Unlit_Penguin`에 FBX에 패킹돼 있던 `T_Penguin_D_1k.png`(1024²)가 **이미 Principled BSDF의 Base Color에 연결**된 채로 들어왔다. 수동 연결 없이 Material Preview 전환으로 텍스처가 그대로 나오는지 확인했고, 확인 렌더까지 뽑았다 — 글 첫머리의 펭귄 렌더가 그 결과다.

한 가지 결정: 8K 원본 `T_Penguin_D.PNG`(105MB)도 있었지만, 뷰포트 확인·리깅 파이프라인 용도로는 과해서 1k를 썼다. 작업 상태는 `SK_Penguin_setup.blend`로 저장.

## 텍스처 내장 FBX 재익스포트 — 3중 검증

이 펭귄은 외부 툴과 UE를 오가는 에셋이라, FBX 하나만 들고 다녀도 어느 툴에서든 생김새가 보이도록 **텍스처를 파일 안에 내장**해 재익스포트했다.

Blender의 FBX 익스포트 대화상자에서 다음 옵션으로 내보냈다.

- **선택 오브젝트만(Selected Objects)** — 펭귄 계층만 대상으로 한정
- **텍스처 내장(Embed Textures)** — 텍스처를 FBX 파일 안에 패킹
- **경로 모드 Copy(Path Mode: Copy)** — Embed Textures가 실제로 동작하는 유일한 조건
- **리프본 제외(Add Leaf Bones 해제)** — UE 리임포트 시 잉여 리프본(`_end`) 방지

결과물 `SK_Penguin_Textured.fbx`(2,220,988B)에 텍스처가 **정말** 들어갔는지를 3중으로 검증했다. "옵션을 켰으니 됐겠지"는 이 파이프라인에서 제일 위험한 가정이다 — `embed_textures`는 `path_mode='COPY'`가 아니면 조용히 무시되기 때문에, 무음 실패가 가능하다.

1. **크기 델타**: 텍스처 없이 뽑은 본체가 312,384B, 1k 텍스처가 1.84MB — 합이 최종 크기와 맞아떨어진다
2. **바이너리 스캔**: FBX 바이너리에서 PNG 시그니처를 직접 스캔해 텍스처 블록 존재 확인
3. **익스포트 로그**: 텍스처 임베드가 수행됐다는 로그 확인

`add_leaf_bones=False`는 나중을 위한 보험이다. 기본값(True)으로 두면 본 끝마다 `_end` 리프본이 붙어서, 리깅을 마치고 UE로 되가져올 때 스켈레톤에 잉여 본이 생긴다.

## UE 애니메이션 적용 확인

리깅 파이프라인의 최종 목적지 확인. IK 리타게터(cc_base_* → IK_Penguin)·ABP_Penguin 구조 상세는 [Tripo 펭귄 AccuRIG 리깅과 UE IK 리타게팅](/posts/til-penguin-accurig-rerig/)에 정리했으므로, 여기서는 **적용이 실제로 돌아가는지**만 에디터에서 확인했다.

![Walking 애니메이션 재생](/assets/img/til/2026-07-23/ue-penguin-anim-playing.png)
_Walking AnimSequence 에디터 — 펭귄 프리뷰에서 재생 중(플레이헤드 진행, 트랙 78개). Triangles 4,898 / Vertices 3,210_

![BS_BaseCharacter 프리뷰](/assets/img/til/2026-07-23/ue-penguin-blendspace.png)
_BS_BaseCharacter 블렌드 스페이스 에디터 — 펭귄 프리뷰 + 블렌드 샘플 3개(Idle/Walk/Slow_Run)_

Walking 시퀀스가 펭귄 스켈레톤에서 정상 재생되고, BS_BaseCharacter 블렌드 스페이스도 펭귄 프리뷰로 동작한다. 그리고 **메인 플레이어 `BP_PlayerCharacter`가 mesh=SK_Penguin, anim_class=ABP_Penguin_C로 사용 중** — 이 파이프라인의 결과물이 실제 플레이어 캐릭터에 물려 있다.

> **핵심 요약**
> - 산출물 검증은 옵션이 아니라 **결과물**로 — `embed_textures`는 크기 델타·PNG 시그니처·로그 3중으로 확인했다. 옵션을 켰다고 결과가 보장되지 않는다
> - `embed_textures`는 `path_mode='COPY'`에서만 동작한다 — 조건이 안 맞으면 에러 없이 무시되는 무음 실패 유형
> - `add_leaf_bones=False`는 UE 왕복의 보험 — 기본값으로 두면 리임포트 때 `_end` 잉여 본이 생긴다
{: .prompt-tip }
