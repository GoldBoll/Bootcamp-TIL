#include "monster.h"
#include "player.h"
Monster::Monster(string name) : name(name), HP(100), power(30), defence(10), speed(10) {}
void Monster::attack(Player* player) {
    int damage = power - player->getDefence();
    if (damage <= 0) damage = 1;
    cout << "* " << name << "이(가) " << player->getNickname() << "에게 " << damage << "의 피해를 입혔다!" << endl;
    player->setHP(player->getHP() - damage);
    if (player->getHP() <= 0)
        cout << "* " << player->getNickname() << "이(가) 쓰러졌습니다..." << endl;
    else
        cout << player->getNickname() << "의 남은 HP: " << player->getHP() << endl;
}
string Monster::getName()   { return name; }
int Monster::getHP()        { return HP; }
int Monster::getPower()     { return power; }
int Monster::getDefence()   { return defence; }
int Monster::getSpeed()     { return speed; }
void Monster::setName(string n) { name = n; }
void Monster::setHP(int v)      { HP = v; }
void Monster::setPower(int v)   { power = v; }
void Monster::setDefence(int v) { defence = v; }
void Monster::setSpeed(int v)   { speed = v; }
