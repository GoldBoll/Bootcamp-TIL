// Fill out your copyright notice in the Description page of Project Settings.

#include "Characters/assignment_5.h"
#include "Engine/Engine.h"
#include "Kismet/KismetMathLibrary.h"

// Sets default values
Aassignment_5::Aassignment_5()
{
	PrimaryActorTick.bCanEverTick = true;
}

// Called when the game starts or when spawned
void Aassignment_5::BeginPlay()
{
	Super::BeginPlay();

	// 시작 위치를 (0, 50, 0)으로 고정
	SetActorLocation(FVector(0.f, 50.f, 0.f));

	// 게임 시작 시 10회 무작위 이동 & 회전 실행
	RunRandomMoveAndTurn();
}

// Called every frame
void Aassignment_5::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	if (!bIsInterpolating || CurrentWaypointIndex >= WaypointLocations.Num())
		return;

	FVector  TargetLoc = WaypointLocations[CurrentWaypointIndex];
	FRotator TargetRot = WaypointRotations[CurrentWaypointIndex];

	// 현재 위치/회전을 목표 쪽으로 부드럽게 보간
	FVector  NewLoc = FMath::VInterpTo(GetActorLocation(), TargetLoc, DeltaTime, InterpSpeed);
	FRotator NewRot = FMath::RInterpTo(GetActorRotation(), TargetRot, DeltaTime, InterpSpeed);

	SetActorLocation(NewLoc);
	SetActorRotation(NewRot);

	// 목표 지점에 충분히 가까워지면 다음 웨이포인트로 전환
	if (FVector::Dist(NewLoc, TargetLoc) < 1.f)
	{
		SetActorLocation(TargetLoc);
		SetActorRotation(TargetRot);

		// 이전 위치에서 현재 목표까지 이동 거리 누적
		TotalDistance += FVector::Dist(PreviousWaypointLocation, TargetLoc);
		PreviousWaypointLocation = TargetLoc;

		const int32 Step = CurrentWaypointIndex + 1;

		// 1. 현재 단계 좌표 출력
		LogCurrentLocation(Step);

		// 2. 50% 확률 이벤트
		if (FMath::FRand() < 0.5f)
		{
			TotalEventCount++;
			TriggerEvent(Step);
		}

		CurrentWaypointIndex++;

		// 3. 10회 완료 시 최종 리포트 출력
		if (CurrentWaypointIndex >= WaypointLocations.Num())
		{
			bIsInterpolating = false;
			PrintFinalReport();
		}
	}
}

// 설정 거리만큼 액터의 전방(ForwardVector) 방향으로 이동
void Aassignment_5::Move(float Distance)
{
	FVector CurrentLocation = GetActorLocation();
	FVector ForwardDir = GetActorForwardVector();
	FVector NewLocation = CurrentLocation + ForwardDir * Distance;
	SetActorLocation(NewLocation);
}

// Z축(Yaw) 기준으로 설정 각도만큼 회전
void Aassignment_5::Turn(float Angle)
{
	FRotator CurrentRotation = GetActorRotation();
	FRotator DeltaRotation(0.f, Angle, 0.f); // Pitch=0, Yaw=Angle, Roll=0
	FRotator NewRotation = CurrentRotation + DeltaRotation;
	SetActorRotation(NewRotation);
}

// 현재 좌표를 화면(AddOnScreenDebugMessage)에 출력
void Aassignment_5::LogCurrentLocation(int32 Step)
{
	FVector Loc = GetActorLocation();
	FString Message = FString::Printf(
		TEXT("[Step %d] Location: X=%.1f, Y=%.1f, Z=%.1f"),
		Step, Loc.X, Loc.Y, Loc.Z
	);

	// 화면에 5초 동안 표시, 색상 노란색
	GEngine->AddOnScreenDebugMessage(
		-1,      // Key: -1이면 메시지가 쌓임
		5.f,     // 표시 시간(초)
		FColor::Yellow,
		Message
	);

	UE_LOG(LogTemp, Log, TEXT("%s"), *Message);
}

// Move / Turn 을 무작위로 10회 반복 (Lerp 보간으로 천천히 이동)
void Aassignment_5::RunRandomMoveAndTurn()
{
	const int32 RepeatCount = 10;

	WaypointLocations.Empty();
	WaypointRotations.Empty();

	// 도전 기능 카운터 초기화
	TotalDistance    = 0.f;
	TotalEventCount  = 0;
	PreviousWaypointLocation = GetActorLocation();

	// 현재 위치/회전을 기준으로 웨이포인트를 시뮬레이션하여 미리 계산
	FVector  SimLocation = GetActorLocation();
	FRotator SimRotation = GetActorRotation();

	for (int32 i = 0; i < RepeatCount; i++)
	{
		// 이동 거리: 50 ~ 200 사이 랜덤
		float RandomDistance = FMath::RandRange(50.f, 200.f);

		// 회전 각도: -180 ~ 180 사이 랜덤
		float RandomAngle = FMath::RandRange(-180.f, 180.f);

		// 현재 시뮬레이션 회전의 전방 방향으로 이동
		FVector ForwardDir = SimRotation.Vector();
		SimLocation += ForwardDir * RandomDistance;

		// Yaw 회전 누적
		SimRotation.Yaw = FRotator::NormalizeAxis(SimRotation.Yaw + RandomAngle);

		WaypointLocations.Add(SimLocation);
		WaypointRotations.Add(SimRotation);
	}

	// 첫 번째 웨이포인트부터 보간 시작
	CurrentWaypointIndex = 0;
	bIsInterpolating = true;
}

// 50% 확률 이벤트 처리 함수
void Aassignment_5::TriggerEvent(int32 Step)
{
	FString Message = FString::Printf(
		TEXT("[Event!] Step %d: 랜덤 이벤트 발생!"),
		Step
	);

	GEngine->AddOnScreenDebugMessage(-1, 5.f, FColor::Red, Message);
	UE_LOG(LogTemp, Warning, TEXT("%s"), *Message);
}

// 10회 이동 완료 후 최종 리포트 출력
void Aassignment_5::PrintFinalReport()
{
	FString ReportDistance = FString::Printf(
		TEXT("[최종 리포트] 총 이동 거리: %.1f cm"),
		TotalDistance
	);
	FString ReportEvent = FString::Printf(
		TEXT("[최종 리포트] 총 이벤트 발생 횟수: %d / 10회"),
		TotalEventCount
	);

	GEngine->AddOnScreenDebugMessage(-1, 10.f, FColor::Cyan, ReportEvent);
	GEngine->AddOnScreenDebugMessage(-1, 10.f, FColor::Cyan, ReportDistance);

	UE_LOG(LogTemp, Log, TEXT("%s"), *ReportDistance);
	UE_LOG(LogTemp, Log, TEXT("%s"), *ReportEvent);
}
