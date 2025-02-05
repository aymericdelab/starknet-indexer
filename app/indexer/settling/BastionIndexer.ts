import { Event } from "./../../entities/starknet/Event";
import { Context } from "./../../context";
import BaseContractIndexer from "./../BaseContractIndexer";
import { uint256ToBN } from "starknet/utils/uint256";
import { BigNumber } from "ethers";

const CONTRACT =
  "0x01c21c4d9e15918f9585ccf02640ad2a86c0bc60c64771f6afb727c553ab417b";

export default class BastionIndexer extends BaseContractIndexer {
  constructor(context: Context) {
    super(context, CONTRACT);

    this.on("BastionArmyMoved", this.bastionArmyMoved.bind(this));
    this.on("BastionLocationTaken", this.bastionLocationTaken.bind(this));
  }

  async bastionArmyMoved(event: Event): Promise<void> {
    const params = event.parameters;
    const lon = BigNumber.from(params[0]).toNumber();
    const lat = BigNumber.from(params[1]).toNumber();
    const bastionPastLocation = parseInt(params[2]);
    const bastionCurrentLocation = parseInt(params[3]);
    const realmId = arrayUInt256ToNumber(params.slice(4, 6));
    const armyId = parseInt(params[6]);
    const bastionId = createBastionId(lat, lon);

    try {
      await this.context.prisma.army.update({
        where: { realmId_armyId: { realmId, armyId } },
        data: {
          bastionId,
          bastionPastLocation,
          bastionCurrentLocation,
          bastionArrivalBlock: event.blockNumber,
        },
      });
    } catch (e) {}
  }

  async bastionLocationTaken(event: Event): Promise<void> {
    const params = event.parameters;
    const longitude = BigNumber.from(params[0]).toNumber();
    const latitude = BigNumber.from(params[1]).toNumber();
    const locationId = parseInt(params[2]);
    const defendingOrderId = parseInt(params[3]);
    const bastionId = createBastionId(latitude, longitude);

    await Promise.allSettled([
      this.context.prisma.bastion.upsert({
        where: { bastionId },
        update: { longitude, latitude },
        create: { bastionId, longitude, latitude },
      }),
      this.context.prisma.bastionLocation.upsert({
        where: { bastionId_locationId: { bastionId, locationId } },
        update: { defendingOrderId, takenBlock: event.blockNumber },
        create: {
          bastionId,
          locationId,
          defendingOrderId,
          takenBlock: event.blockNumber,
        },
      }),
    ]);
  }
}

function createBastionId(lat: number, lon: number) {
  return lat + lon;
}

function arrayUInt256ToNumber([low, high]: any[]) {
  return parseInt(uint256ToBN({ low, high }).toString());
}
