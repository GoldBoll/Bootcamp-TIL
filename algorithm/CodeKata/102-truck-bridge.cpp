//https://school.programmers.co.kr/learn/courses/30/lessons/42583

#include <vector>
#include <queue>

using namespace std;

int solution(int bridge_length, int weight, vector<int> truck_weights) {
    queue<int> bridge;
    for (int i = 0; i < bridge_length; i++) bridge.push(0);   // 다리 = 길이만큼의 칸, 0은 빈 칸

    int t = 0, load = 0, idx = 0;
    int n = truck_weights.size();

    while (idx < n) {
        t++;
        load -= bridge.front(); bridge.pop();                 // 맨 앞 칸이 다리를 빠져나간다

        if (load + truck_weights[idx] <= weight) {            // 하중이 남으면 다음 트럭 진입
            load += truck_weights[idx];
            bridge.push(truck_weights[idx]);
            idx++;
        }
        else bridge.push(0);                                  // 못 들어가면 빈 칸을 밀어 넣어 한 칸 전진
    }
    return t + bridge_length;                                 // 마지막 트럭이 다리를 다 건너는 시간
}
