// Fill out your copyright notice in the Description page of Project Settings.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "assignment_5.generated.h"

UCLASS()
class MULTIPLAYERTOPDOWNKIT_API Aassignment_5 : public AActor
{
	GENERATED_BODY()

public:
	Aassignment_5();

protected:
	virtual void BeginPlay() override;

public:
	virtual void Tick(float DeltaTime) override;

	// 설정 거리만큼 액터를 이동시킵니다
	UFUNCTION(BlueprintCallable, Category = "Assignment5")
	void Move(float Distance);

	// 설정 각도만큼 액터를 Z축 기준으로 회전시킵니다
	UFUNCTION(BlueprintCallable, Category = "Assignment5")
	void Turn(float Angle);

	// Move/Turn을 무작위로 10회 반복 실행하고 화면에 좌표 로그를 출력합니다
	UFUNCTION(BlueprintCallable, Category = "Assignment5")
	void RunRandomMoveAndTurn();

	// 50% 확률 이벤트 함수
	UFUNCTION(BlueprintCallable, Category = "Assignment5")
	void TriggerEvent(int32 Step);

private:
	// 현재 좌표와 단계를 화면에 출력합니다
	void LogCurrentLocation(int32 Step);

	// 최종 리포트를 화면에 출력합니다
	void PrintFinalReport();

	// Lerp 이동에 사용할 웨이포인트 목록
	TArray<FVector>   WaypointLocations;
	TArray<FRotator>  WaypointRotations;

	// 현재 진행 중인 웨이포인트 인덱스
	int32 CurrentWaypointIndex = 0;

	// 보간 진행 여부
	bool bIsInterpolating = false;

	// 보간 속도 (값이 클수록 빠름)
	UPROPERTY(EditAnywhere, Category = "Assignment5")
	float InterpSpeed = 3.f;

	// 누적 이동 거리
	float TotalDistance = 0.f;

	// 이벤트 발생 횟수
	int32 TotalEventCount = 0;

	// 이전 웨이포인트 위치 (거리 계산용)
	FVector PreviousWaypointLocation;
};
