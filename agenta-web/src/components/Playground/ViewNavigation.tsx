import React from "react"
import {Col, Row, Divider, Button, Tooltip, Spin, notification} from "antd"
import TestView from "./Views/TestView"
import ParametersView from "./Views/ParametersView"
import {useVariant} from "@/lib/hooks/useVariant"
import {Environment, Variant} from "@/lib/Types"
import {useRouter} from "next/router"
import {useState} from "react"
import axios from "axios"
import {createUseStyles} from "react-jss"
import {getAppContainerURL, restartAppVariantContainer, waitForAppToStart} from "@/lib/services/api"
import {useAppsData} from "@/contexts/app.context"

interface Props {
    variant: Variant
    handlePersistVariant: (variantName: string) => void
    setRemovalVariantName: (variantName: string) => void
    setRemovalWarningModalOpen: (value: boolean) => void
    isDeleteLoading: boolean
    environments: Environment[]
    onAdd: () => void
}

const useStyles = createUseStyles({
    row: {
        marginTop: "20px",
    },
    restartBtnMargin: {
        marginRight: "10px",
    },
})

const ViewNavigation: React.FC<Props> = ({
    variant,
    handlePersistVariant,
    setRemovalVariantName,
    setRemovalWarningModalOpen,
    isDeleteLoading,
    environments,
    onAdd,
}) => {
    const classes = useStyles()
    const router = useRouter()
    const appId = router.query.app_id as unknown as string
    const {
        inputParams,
        optParams,
        URIPath,
        isError,
        error,
        isParamSaveLoading,
        saveOptParams,
        isLoading,
    } = useVariant(appId, variant)

    const [isParamsCollapsed, setIsParamsCollapsed] = useState("1")
    const [containerURIPath, setContainerURIPath] = useState("")
    const [restarting, setRestarting] = useState<boolean>(false)
    const {currentApp} = useAppsData()

    let prevKey = ""
    const showNotification = (config: Parameters<typeof notification.open>[0]) => {
        if (prevKey) notification.destroy(prevKey)
        prevKey = (config.key || "") as string
        notification.open(config)
    }

    if (isError) {
        let variantDesignator = variant.templateVariantName
        let imageName = `agentaai/${(currentApp?.app_name || "").toLowerCase()}_`

        if (!variantDesignator || variantDesignator === "") {
            variantDesignator = variant.variantName
            imageName += variantDesignator.toLowerCase()
        } else {
            imageName += variantDesignator.toLowerCase()
        }

        const variantContainerPath = async () => {
            const urlPath = await getAppContainerURL(appId, variant.variantId, variant.baseId)
            setContainerURIPath(urlPath)
        }
        if (!containerURIPath) {
            variantContainerPath()
        }

        const restartContainerHandler = async () => {
            // Set restarting to true
            setRestarting(true)
            try {
                const response = await restartAppVariantContainer(variant.variantId)
                if (response.status === 200) {
                    showNotification({
                        type: "success",
                        message: "App Container",
                        description: `${response.data.message}`,
                        duration: 5,
                        key: response.status,
                    })

                    // Set restarting to false
                    await waitForAppToStart(appId)
                    router.reload()
                    setRestarting(false)
                }
            } catch {
            } finally {
                setRestarting(false)
            }
        }

        const apiAddress = `${process.env.NEXT_PUBLIC_AGENTA_API_URL}/${containerURIPath}/openapi.json`
        return (
            <div>
                {error ? (
                    <div>
                        <p>
                            Error connecting to the variant {variant.variantName}.{" "}
                            {(axios.isAxiosError(error) && error.response?.status === 404 && (
                                <span>Container is not running.</span>
                            )) || <span>{error.message}</span>}
                        </p>
                        <p>To debug this issue, please follow the steps below:</p>
                        <ul>
                            <li>
                                Verify whether the API is up by checking if {apiAddress} is
                                accessible.
                            </li>
                            <li>
                                Check if the Docker container for the variant {variantDesignator} is
                                running. The image should be called {imageName}.
                            </li>
                        </ul>
                        <p>
                            {" "}
                            In case the docker container is not running. Please check the logs from
                            docker to understand the issue. Most of the time it is a missing
                            requirements. Also, please attempt restarting it (using cli or docker
                            desktop)
                        </p>
                        <p>
                            {" "}
                            If the issue persists please file an issue in github here:
                            https://github.com/Agenta-AI/agenta/issues/new?title=Issue%20in%20ViewNavigation.tsx
                        </p>

                        <Button
                            type="primary"
                            onClick={() => {
                                restartContainerHandler()
                            }}
                            disabled={restarting}
                            loading={restarting}
                            className={classes.restartBtnMargin}
                        >
                            <Tooltip placement="bottom" title="Restart the variant container">
                                Restart Container
                            </Tooltip>
                        </Button>

                        <Button
                            type="primary"
                            danger
                            onClick={() => {
                                setRemovalVariantName(variant.variantName)
                                setRemovalWarningModalOpen(true)
                            }}
                            loading={isDeleteLoading}
                        >
                            <Tooltip placement="bottom" title="Delete the variant permanently">
                                Delete Variant
                            </Tooltip>
                        </Button>
                    </div>
                ) : null}
            </div>
        )
    }

    return (
        <Spin spinning={isLoading}>
            <Row gutter={[{xs: 8, sm: 16, md: 24, lg: 32}, 20]}>
                <Col span={24}>
                    <ParametersView
                        variant={variant}
                        optParams={optParams}
                        isParamSaveLoading={isParamSaveLoading}
                        onOptParamsChange={saveOptParams}
                        handlePersistVariant={handlePersistVariant}
                        isPersistent={variant.persistent} // if the variant persists in the backend, then saveoptparams will need to know to update and not save new variant
                        setRemovalVariantName={setRemovalVariantName}
                        setRemovalWarningModalOpen={setRemovalWarningModalOpen}
                        isDeleteLoading={isDeleteLoading}
                        isParamsCollapsed={isParamsCollapsed}
                        setIsParamsCollapsed={setIsParamsCollapsed}
                        environments={environments}
                        onAdd={onAdd}
                    />
                </Col>
            </Row>
            <Divider />

            <Row gutter={[{xs: 8, sm: 16, md: 24, lg: 32}, 20]} className={classes.row}>
                <Col span={24}>
                    <TestView inputParams={inputParams} optParams={optParams} URIPath={URIPath} />
                </Col>
            </Row>
        </Spin>
    )
}

export default ViewNavigation
