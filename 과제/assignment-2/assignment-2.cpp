#include <iostream>
#include <windows.h>
#include "player.h"
#include "warrior.h"
#include "magician.h"
#include "thief.h"
#include "archer.h"
#include "monster.h"
using namespace std;

int main() {
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);

    string jobs[] = { "전사", "마법사", "도적", "궁수" };
    int job_choice = 0;
    string nickname;
    Player* player = nullptr;

    cout << "* 닉네임을 입력해주세요: ";
    cin >> nickname;

    cout << "<전직 시스템>" << endl;
    cout << nickname << "님, 환영합니다!" << endl;
    cout << "* 원하시는 직업을 선택해주세요." << endl;
    for (int i = 0; i < 4; i++) {
        cout << (i + 1) << ". " << jobs[i] << endl;
    }

    cout << "선택: ";
    cin >> job_choice;

    switch (job_choice) {
    case 1: player = new Warrior(nickname);  break;
    case 2: player = new Magician(nickname); break;
    case 3: player = new Thief(nickname);    break;
    case 4: player = new Archer(nickname);   break;
    default:
        cout << "잘못된 입력입니다." << endl;
        return 1;
    }

    player->attack();
    player->printPlayerStatus();

    cout << "\n* 몬스터가 나타났습니다!" << endl;
    Monster* monster = new Monster("몬스터");
    int turn = 1;
    while (monster->getHP() > 0 && player->getHP() > 0) {
        cout << "\n--- " << turn << "턴 ---" << endl;
        cout << "[" << player->getNickname() << "] HP: " << player->getHP()
             << " | [" << monster->getName() << "] HP: " << monster->getHP() << endl;
        player->attack(monster);
        if (monster->getHP() > 0)
            monster->attack(player);
        Sleep(500);
        turn++;
    }

    if (monster->getHP() <= 0)
        cout << "\n* 몬스터를 처치했습니다!" << endl;
    else
        cout << "\n* 쓰러졌습니다..." << endl;

    cout << "* 아무 키나 누르면 종료됩니다...";
    cin.ignore();
    cin.get();
    return 0;
}
