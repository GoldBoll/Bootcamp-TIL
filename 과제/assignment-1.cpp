#include <iostream>
using namespace std;

// 포션 지급 함수
void setPotion(int count, int* p_HPPotion, int* p_MPPotion)
{
    *p_HPPotion += count;
    *p_MPPotion += count;
    cout << "* 포션이 지급되었습니다. (HP, MP 포션 각 " << count << "개)" << endl;
}

int main()
{
    // 1. 캐릭터 스탯 배열: [0]=HP, [1]=MP, [2]=공격력, [3]=방어력
    int status[4] = { 0, 0, 0, 0 };

    // 도전: 레벨 변수
    int level = 1;

    // 2. 깐깐한 입력 검사 - HP/MP (51 이상)
    do {
        cout << "HP와 MP를 입력해주세요: ";
        cin >> status[0] >> status[1];
        if (status[0] <= 50 || status[1] <= 50)
            cout << "HP나 MP의 값이 너무 작습니다. 다시 입력해주세요." << endl;
    } while (status[0] <= 50 || status[1] <= 50);

    // 2. 깐깐한 입력 검사 - 공격력/방어력 (1 이상)
    do {
        cout << "공격력과 방어력을 입력해주세요: ";
        cin >> status[2] >> status[3];
        if (status[2] <= 0 || status[3] <= 0)
            cout << "공격력이나 방어력의 값이 너무 작습니다. 다시 입력해주세요." << endl;
    } while (status[2] <= 0 || status[3] <= 0);

    // 포션 초기 지급 (각 5개)
    int HPPotion = 0, MPPotion = 0;
    setPotion(5, &HPPotion, &MPPotion);

    // 3. 스탯 관리 시스템 - 메뉴 무한 루프
    int choice = -1;
    while (choice != 0)
    {
        cout << "=============================================" << endl;
        cout << "<스탯 관리 시스템>" << endl;
        cout << "1. HP UP" << endl;
        cout << "2. MP UP" << endl;
        cout << "3. 공격력 UP" << endl;
        cout << "4. 방어력 UP" << endl;
        cout << "5. 현재 능력치" << endl;
        cout << "6. Level UP" << endl;
        cout << "0. 나가기" << endl;
        cout << "번호를 선택해주세요: ";
        cin >> choice;

        switch (choice)
        {
        case 1: // HP UP - HP 포션 사용
            if (HPPotion <= 0)
            {
                cout << "포션이 부족합니다." << endl;
            }
            else
            {
                status[0] += 20;
                HPPotion--;
                cout << "* HP가 20 증가되었습니다. 포션이 1개 차감됩니다." << endl;
                cout << "현재 HP: " << status[0] << endl;
                cout << "남은 포션 수: " << HPPotion << endl;
            }
            break;

        case 2: // MP UP - MP 포션 사용
            if (MPPotion <= 0)
            {
                cout << "포션이 부족합니다." << endl;
            }
            else
            {
                status[1] += 20;
                MPPotion--;
                cout << "* MP가 20 증가되었습니다. 포션이 1개 차감됩니다." << endl;
                cout << "현재 MP: " << status[1] << endl;
                cout << "남은 포션 수: " << MPPotion << endl;
            }
            break;

        case 3: // 공격력 2배
            // 방법 1: status[2] *= 2;
            // 방법 2: status[2] <<= 1; (비트 시프트 - 왼쪽으로 1비트 = x2)
            status[2] <<= 1;
            cout << "* 공격력이 2배로 증가되었습니다." << endl;
            cout << "현재 공격력: " << status[2] << endl;
            break;

        case 4: // 방어력 2배
            status[3] *= 2;
            cout << "* 방어력이 2배로 증가되었습니다." << endl;
            cout << "현재 방어력: " << status[3] << endl;
            break;

        case 5: // 현재 능력치 출력
            cout << "* HP : " << status[0]
                 << ", MP : " << status[1]
                 << ", 공격력 : " << status[2]
                 << ", 방어력 : " << status[3] << endl;
            // 도전: 레벨 및 포션 수 함께 출력
            cout << "* 현재 레벨: " << level << endl;
            cout << "* 남은 HP/MP 포션 수: " << HPPotion << "/" << MPPotion << endl;
            break;

        case 6: // Level Up - 포션 각 1개 추가
            level++;
            setPotion(1, &HPPotion, &MPPotion);
            cout << "* 레벨업! HP/MP 포션이 지급됩니다." << endl;
            cout << "남은 HP/MP 포션 수 : " << HPPotion << "/" << MPPotion << endl;
            break;

        case 0: // 나가기
            cout << "프로그램을 종료합니다." << endl;
            break;

        default:
            cout << "올바른 번호를 입력해주세요." << endl;
            break;
        }
    }

    return 0;
}
